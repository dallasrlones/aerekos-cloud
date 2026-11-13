# Upgrade guide (v0.1.0)

## From preview / pre-GA

1. Read [`GA_CHECKLIST.md`](GA_CHECKLIST.md) and [`CHANGELOG.md`](../CHANGELOG.md).
2. Backup conductor DB: `scripts/ops/conductor-backup.sh` ([restore drill](runbooks/conductor-restore-drill.md)).
3. Pull / unpack release; do **not** use `--remove-orphans` on mixed-stack hosts (ADR 003).
4. Set `AUTH_REQUIRED=true` (and `AI_AUTH_REQUIRED=true` on Orin AI compose).
5. Re-run non-prod smokes: `e2e/icarus-platform-matrix.js`, `e2e/icarus-wants-matrix.js`.

## Compute API

Legacy `/api/v1/tasks` remains. Prefer `/api/v1/deployments` (aerekos Compute). See ADR 004.

## Public mirror

```bash
bash scripts/oss/check-mirror-scrub.sh
bash scripts/oss/pack-mirror.sh /tmp/aerekos-cloud-oss-mirror
```
