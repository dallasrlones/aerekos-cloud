# Runbooks

Operator docs for the homelab fleet. **Mac checkout is source of truth.** Devices are deploy targets.

| Runbook | When to read |
|---------|----------------|
| [deploy.md](deploy.md) | Push Mac → prod-mini / dev-mini / oculus; rebuild roles |
| [mixed-stack.md](mixed-stack.md) | prod-mini conductor (`docker-compose.yml`) + managers (`docker-compose.core.yml`) |
| [fleet-startup.md](fleet-startup.md) | Power-on order, registration token, public URLs |
| [icarus.md](icarus.md) | Cloud-owned icarus app (prod-mini, icarus.aerekos.com) |
| [icarus-assistant.md](icarus-assistant.md) | Cloud-owned assistant (prod-mini, assistant.aerekos.com) |
| [forged-lumen.md](forged-lumen.md) | Cloud-owned forged-lumen (dev-mini pin, existing tunnel) |
| [orphans.md](orphans.md) | dating, Orin leftovers, docunu, registry |
| [icarus-agents.md](icarus-agents.md) | Icarus in AI Manager: setup, chat, tools, connectors, live canvas |
| [icarus-c0.md](icarus-c0.md) | Icarus C0: timeouts, app tokens, storage, smoke |
| [icarus-live-e2e.md](icarus-live-e2e.md) | C1–C8 + T65 live scripts |
| [lora-gpu.md](lora-gpu.md) | PEFT LoRA trainer on oculus (do not restart vLLM) |
| [auth-required.md](auth-required.md) | `AUTH_REQUIRED=true` manager auth flip (prod compose) |
| [git-vs-ide.md](git-vs-ide.md) | git_manager hosting vs Icarus IDE workspace (W4) |
| [auth-port-quirk.md](auth-port-quirk.md) | auth_manager listen vs port-detection registration mismatch |
| [key-rotation.md](key-rotation.md) | Signing / envelope keys |
| [incident.md](incident.md) | Incident response |

Icarus agents are in this repo (`docs/runbooks/icarus-agents.md`). The older standalone beta lives in `icarus-agent` and is not vendored.
