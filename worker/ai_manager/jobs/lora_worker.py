#!/usr/bin/env python3
"""GPU LoRA worker. Ticket T40. Polls /data/lora-jobs and trains PEFT adapters on CUDA.

Does not import torch until a job is queued so idle RAM stays low. Shares
ai_manager-data with ai_manager. Never talks to the running vLLM process.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import traceback
from pathlib import Path

JOBS = Path(os.environ.get("LORA_JOBS_DIR", "/data/lora-jobs"))
PIP_TARGET = Path(os.environ.get("LORA_PIP_DIR", "/data/lora-pip"))
BASE = os.environ.get("LORA_BASE_MODEL", "sshleifer/tiny-gpt2")
STEPS = int(os.environ.get("LORA_MAX_STEPS", "8"))
POLL = float(os.environ.get("LORA_POLL_S", "2"))


def ensure_peft() -> None:
    try:
        import peft  # noqa: F401
        import transformers  # noqa: F401
        return
    except ImportError:
        pass
    PIP_TARGET.mkdir(parents=True, exist_ok=True)
    if str(PIP_TARGET) not in sys.path:
        sys.path.insert(0, str(PIP_TARGET))
    try:
        import peft  # noqa: F401
        import transformers  # noqa: F401
        return
    except ImportError:
        pass
    subprocess.check_call(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "-q",
            "-t",
            str(PIP_TARGET),
            "--no-deps",
            "peft",
            "pyyaml",
        ]
    )
    if str(PIP_TARGET) not in sys.path:
        sys.path.insert(0, str(PIP_TARGET))


def train_one(job_dir: Path) -> dict:
    ensure_peft()
    import torch
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is required for LoRA train")
    torch.cuda.empty_cache()

    queued = json.loads((job_dir / "queued.json").read_text())
    base = queued.get("base") or BASE
    steps = int(queued.get("steps") or STEPS)
    examples_path = job_dir / "examples.jsonl"
    texts = []
    if examples_path.exists():
        for line in examples_path.read_text().splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            texts.append(
                f"User: {row.get('in') or row.get('input') or ''}\n"
                f"Assistant: {row.get('out') or row.get('output') or ''}"
            )
    if not texts:
        texts = ["User: hi\nAssistant: hello"]

    out_dir = job_dir / "adapter"
    out_dir.mkdir(parents=True, exist_ok=True)
    tok = AutoTokenizer.from_pretrained(base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(base)
    names = {n for n, _ in model.named_modules()}
    targets = ["q_proj", "v_proj"] if "q_proj" in names else ["c_attn"]
    model = get_peft_model(
        model,
        LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=8,
            lora_alpha=16,
            lora_dropout=0.05,
            target_modules=targets,
        ),
    )
    model.cuda()
    model.train()
    params = [p for p in model.parameters() if p.requires_grad]
    opt = torch.optim.AdamW(params, lr=2e-4)
    t0 = time.time()
    last_loss = None
    try:
        for step in range(max(1, steps)):
            text = texts[step % len(texts)]
            batch = tok(text, return_tensors="pt", truncation=True, max_length=64)
            batch = {k: v.cuda() for k, v in batch.items()}
            out = model(**batch, labels=batch["input_ids"])
            last_loss = float(out.loss.detach().cpu())
            out.loss.backward()
            opt.step()
            opt.zero_grad()
        model.save_pretrained(str(out_dir))
        tok.save_pretrained(str(out_dir))
        return {
            "ok": True,
            "cuda": True,
            "device": torch.cuda.get_device_name(0),
            "base": base,
            "steps": steps,
            "loss": last_loss,
            "seconds": round(time.time() - t0, 3),
            "out": str(out_dir),
            "target_modules": targets,
        }
    finally:
        del model, opt, tok
        torch.cuda.empty_cache()


def run_job(job_dir: Path) -> None:
    running = job_dir / "running.json"
    running.write_text(json.dumps({"started_at": time.time()}))
    last_err = None
    for attempt in range(3):
        try:
            result = train_one(job_dir)
            (job_dir / "done.json").write_text(json.dumps(result, indent=2))
            failed = job_dir / "failed.json"
            if failed.exists():
                failed.unlink()
            print(f"[lora_trainer] done {job_dir.name} loss={result.get('loss')} s={result.get('seconds')}", flush=True)
            if running.exists():
                running.unlink()
            return
        except Exception as e:
            last_err = e
            msg = str(e)
            retryable = "NVML" in msg or "CUDA" in msg or "out of memory" in msg.lower()
            print(f"[lora_trainer] attempt {attempt + 1} {job_dir.name}: {e}", flush=True)
            if not retryable or attempt == 2:
                break
            time.sleep(5 * (attempt + 1))
    (job_dir / "failed.json").write_text(
        json.dumps({"ok": False, "error": str(last_err), "trace": traceback.format_exc()})
    )
    print(f"[lora_trainer] failed {job_dir.name}: {last_err}", flush=True)
    if running.exists():
        running.unlink()


def ensure_pika():
    try:
        import pika  # noqa: F401
        return
    except ImportError:
        pass
    PIP_TARGET.mkdir(parents=True, exist_ok=True)
    if str(PIP_TARGET) not in sys.path:
        sys.path.insert(0, str(PIP_TARGET))
    try:
        import pika  # noqa: F401
        return
    except ImportError:
        pass
    subprocess.check_call(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "-q",
            "-t",
            str(PIP_TARGET),
            "pika",
        ]
    )
    if str(PIP_TARGET) not in sys.path:
        sys.path.insert(0, str(PIP_TARGET))


def consume_amqp() -> None:
    ensure_pika()
    import pika
    url = os.environ.get("RABBITMQ_URL") or ""
    if not url:
        return
    params = pika.URLParameters(url)
    params.heartbeat = 30
    conn = pika.BlockingConnection(params)
    ch = conn.channel()
    ch.basic_qos(prefetch_count=1)
    inbox = os.environ.get("LORA_INBOX") or "lora-inbox"
    project = os.environ.get("LORA_PROJECT_ID") or ""
    qn = f"aerekos.{project}.{inbox}" if project else inbox
    ch.queue_declare(queue=qn, durable=True)

    def on_msg(channel, method, properties, body):
        try:
            payload = json.loads(body.decode("utf-8") or "{}")
        except Exception:
            payload = {}
        job_id = payload.get("job_id") or payload.get("id")
        job_dir = JOBS / str(job_id) if job_id else None
        if job_dir and job_dir.is_dir() and (job_dir / "queued.json").exists():
            if not (job_dir / "done.json").exists() and not (job_dir / "failed.json").exists():
                print(f"[lora_trainer] amqp start {job_dir.name}", flush=True)
                run_job(job_dir)
        channel.basic_ack(delivery_tag=method.delivery_tag)

    ch.basic_consume(queue=qn, on_message_callback=on_msg, auto_ack=False)
    print("[lora_trainer] consuming", qn, flush=True)
    ch.start_consuming()


def poll_disk() -> None:
    print("[lora_trainer] watching", JOBS, "base", BASE, "steps", STEPS, flush=True)
    JOBS.mkdir(parents=True, exist_ok=True)
    for stale in JOBS.glob("*/running.json"):
        stale.unlink()
        print("[lora_trainer] cleared stale", stale.parent.name, flush=True)
    while True:
        for job_dir in sorted(JOBS.glob("*")):
            if not job_dir.is_dir():
                continue
            if (job_dir / "done.json").exists() or (job_dir / "failed.json").exists():
                continue
            if not (job_dir / "queued.json").exists():
                continue
            if (job_dir / "running.json").exists():
                continue
            print(f"[lora_trainer] start {job_dir.name}", flush=True)
            run_job(job_dir)
        time.sleep(POLL)


def main() -> None:
    JOBS.mkdir(parents=True, exist_ok=True)
    if os.environ.get("RABBITMQ_URL") and os.environ.get("SKIP_LORA") != "1":
        try:
            consume_amqp()
            return
        except Exception as e:
            print("[lora_trainer] amqp failed, disk poll:", e, flush=True)
    poll_disk()


if __name__ == "__main__":
    main()
