# OSS mirror scrub

Public mirrors of **aerekos-cloud** ship **platform code and docs only**. Personal fleets, product apps, secrets, and object-store dumps never belong in an OSS bundle.

## What never ships

| Class | Examples | Why |
|-------|----------|-----|
| Personal product repos | `aerekos-tv`, `aerekos-music`, `aerekos-drive`, `forged-lumen` | Separate products / private deployments — not the control-plane OSS scope |
| Secrets | `.env`, `.env.local`, production tokens | Credential leak; rotate on device if exposed — **do not** commit or mirror |
| Bucket / storage dumps | `bucket-dump/`, `*-bucket-dump.*`, offline exports | May contain media, mail, or other PII |
| Session notes with credentials | e.g. `TONIGHT-*.md` on fleet hosts | Rotate on device; keep out of git |

This pass is **docs + scripts only**. Secret rotation on live devices is a separate operator runbook — nothing here rotates keys on prod/dev/orin.

## Denylist

Canonical patterns: [`scripts/oss/mirror-denylist.txt`](../scripts/oss/mirror-denylist.txt).

Add a line when you discover a new personal-data path class. Prefer **directory names** over broad globs when possible.

## Pre-publish check

From the repository root:

```bash
chmod +x scripts/oss/check-mirror-scrub.sh   # once
./scripts/oss/check-mirror-scrub.sh
```

The script exits non-zero if any denylisted path exists in the tree (excluding `node_modules` and `.git`).

## Related docs

- [GA maturity matrix](GA_MATURITY.md) — which managers are GA / needs-keys / preview
- [`../aerekos-cloud-STATUS.md`](../aerekos-cloud-STATUS.md) — private fleet inventory (sibling; do not mirror verbatim if it contains host-specific notes)

## Contributor rule

If a feature needs real user data to demo, use **synthetic fixtures** under `tests/` or documented sample JSON. Never copy production buckets or `.env` into the repo for convenience.
