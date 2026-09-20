'use strict';

const { canFitLocal, estimateModelGb, insufficientError } = require('../../../shared/capacity');

const CONTAINER = process.env.VLLM_CONTAINER_NAME || 'aerekos-vllm';
const DEFAULT_IMAGE = process.env.VLLM_IMAGE || 'ghcr.io/nvidia-ai-iot/vllm:latest-jetson-orin';
const HF_CACHE = process.env.VLLM_MODELS_CACHE || '/home/aerekos/.cache/huggingface';
const SETTLE_MS = parseInt(process.env.VLLM_APPLY_SETTLE_MS || '20000', 10);

function parseParamsB(modelId) {
  const matches = String(modelId || '').match(/(\d+(?:\.\d+)?)B/gi) || [];
  const nums = matches.map((m) => parseFloat(m)).filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) : 27;
}

function buildServeCmd(model, options = {}) {
  const quant = options.quantization && options.quantization !== 'none'
    ? String(options.quantization)
    : 'awq';
  const gpu = options.gpu_memory_utilization != null
    ? Number(options.gpu_memory_utilization)
    : 0.90;
  const cmd = [
    'vllm', 'serve', String(model),
    '--host', '0.0.0.0',
    '--port', '8000',
    '--quantization', quant,
    '--dtype', String(options.dtype || 'half'),
    '--gpu-memory-utilization', String(gpu || 0.90),
    '--max-model-len', String(options.max_model_len || 8192),
    '--max-num-seqs', String(options.max_num_seqs || 8),
  ];
  if (options.enable_prefix_caching !== false) cmd.push('--enable-prefix-caching');
  cmd.push('--language-model-only');
  if (options.enforce_eager !== false) cmd.push('--enforce-eager');
  cmd.push('--reasoning-parser', String(options.reasoning_parser || 'qwen3'));
  return cmd;
}

function parseServeCmd(cmd) {
  const arr = Array.isArray(cmd) ? cmd : [];
  const flag = (name) => {
    const i = arr.indexOf(name);
    if (i >= 0 && arr[i + 1] && !String(arr[i + 1]).startsWith('--')) return arr[i + 1];
    return undefined;
  };
  const out = {};
  const gpu = flag('--gpu-memory-utilization');
  if (gpu != null) out.gpu_memory_utilization = Number(gpu);
  const len = flag('--max-model-len');
  if (len != null) out.max_model_len = Number(len);
  const seqs = flag('--max-num-seqs');
  if (seqs != null) out.max_num_seqs = Number(seqs);
  const quant = flag('--quantization');
  if (quant != null) out.quantization = String(quant);
  const dtype = flag('--dtype');
  if (dtype != null) out.dtype = String(dtype);
  const parser = flag('--reasoning-parser');
  if (parser != null) out.reasoning_parser = String(parser);
  if (arr.includes('--enable-prefix-caching')) out.enable_prefix_caching = true;
  if (arr.includes('--enforce-eager')) out.enforce_eager = true;
  return out;
}

function parseOpts(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class VllmServeService {
  constructor(deps = {}) {
    this.dockerFactory = deps.dockerFactory || (() => {
      if (process.env.SKIP_VLLM_APPLY === '1') return null;
      try {
        const Docker = require('dockerode');
        return new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
      } catch {
        return null;
      }
    });
  }

  async apply(provider, body = {}) {
    const model = String(body.model || provider.model || '').trim();
    if (!model) {
      const e = new Error('Hugging Face model id is required');
      e.status = 400;
      throw e;
    }

    const docker = this.dockerFactory();
    if (!docker) {
      const e = new Error('vLLM apply needs Docker on the GPU host');
      e.status = 501;
      throw e;
    }

    let existing = null;
    let live = {};
    try {
      existing = docker.getContainer(CONTAINER);
      const info = await existing.inspect();
      live = parseServeCmd(info.Config?.Cmd);
    } catch {
      existing = null;
    }

    const stored = parseOpts(provider.options);
    const options = { ...live, ...stored, ...(body.options || {}) };
    const requestGb = estimateModelGb({ paramsB: parseParamsB(model), quant: options.quantization || 'awq' });
    const fit = canFitLocal({ requestGb });
    if (!fit.ok) throw insufficientError(fit, { model });

    const cmd = buildServeCmd(model, options);

    let image = DEFAULT_IMAGE;
    let hostConfig = {
      Runtime: 'nvidia',
      NetworkMode: 'host',
      ShmSize: 16 * 1024 * 1024 * 1024,
      Binds: [`${HF_CACHE}:/root/.cache/huggingface`],
      RestartPolicy: { Name: 'no' },
      DeviceRequests: [{ Count: -1, Capabilities: [['gpu']] }],
    };
    const env = ['HF_HOME=/root/.cache/huggingface', 'NVIDIA_VISIBLE_DEVICES=all'];

    if (existing) {
      const info = await existing.inspect();
      image = info.Config?.Image || image;
      if (info.HostConfig) {
        hostConfig = {
          ...info.HostConfig,
          RestartPolicy: { Name: 'no' },
        };
      }
      try { await existing.stop({ t: 20 }); } catch (_) { /* already stopped */ }
      try { await existing.remove({ force: true }); } catch (_) { /* gone */ }
    }

    const container = await docker.createContainer({
      name: CONTAINER,
      Image: image,
      Cmd: cmd,
      Env: env,
      HostConfig: hostConfig,
    });
    await container.start();

    const settled = await this._waitSettled(container, SETTLE_MS);
    if (!settled.running && (settled.exitCode === 1 || settled.exitCode === 137)) {
      return {
        ok: false,
        left_stopped: true,
        exit_code: settled.exitCode,
        model,
        message: settled.exitCode === 137
          ? 'vLLM OOM (exit 137) — left stopped'
          : 'vLLM engine failed (exit 1) — left stopped',
      };
    }
    return {
      ok: true,
      started: true,
      healthy: settled.running,
      exit_code: settled.exitCode,
      model,
      cmd,
      message: settled.running
        ? 'vLLM started. First Hugging Face download may take a while; poll /v1/models.'
        : 'vLLM container is not running yet',
    };
  }

  async _waitSettled(container, ms) {
    const deadline = Date.now() + ms;
    let last = { running: false, exitCode: null };
    while (Date.now() < deadline) {
      const info = await container.inspect();
      const state = info.State || {};
      last = { running: !!state.Running, exitCode: state.ExitCode ?? null };
      if (!state.Running && (state.ExitCode === 1 || state.ExitCode === 137 || state.Status === 'exited')) {
        return last;
      }
      await sleep(2000);
    }
    return last;
  }
}

module.exports = { VllmServeService, buildServeCmd, parseParamsB, parseServeCmd };
