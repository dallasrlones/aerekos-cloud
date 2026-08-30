# Runbooks

Operator docs for the homelab fleet. **Mac checkout is source of truth.** Devices are deploy targets.

| Runbook | When to read |
|---------|----------------|
| [deploy.md](deploy.md) | Push Mac → prod-mini / dev-mini / oculus; rebuild roles |
| [mixed-stack.md](mixed-stack.md) | prod-mini conductor (`docker-compose.yml`) + managers (`docker-compose.core.yml`) |
| [fleet-startup.md](fleet-startup.md) | Power-on order, registration token, public URLs |
| [icarus-c0.md](icarus-c0.md) | Icarus C0: timeouts, app tokens, storage, smoke |
| [icarus-live-e2e.md](icarus-live-e2e.md) | C1–C8 + T65 live scripts |
| [lora-gpu.md](lora-gpu.md) | PEFT LoRA trainer on oculus (do not restart vLLM) |
| [key-rotation.md](key-rotation.md) | Signing / envelope keys |
| [incident.md](incident.md) | Incident response |

Icarus (separate repo) human docs: `icarus-agent/docs/cloud.md`, `icarus-agent/docs/cli.md`.
