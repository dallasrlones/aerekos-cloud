# Other orphans (inventory only)

Do not invent source trees. Git/CI only if a checkout exists under `/Users/dallaslones/work`.

## dating (prod-mini)

Adopted in place, no volumes, no Mac tree.

| What | Value |
|------|--------|
| Project | `d316c647-803a-4b55-905e-eea1ff34912f` |
| Tasks | `dating-api` `0078d1aa-…`, `dating-app` `4056a158-…` |
| Ports | `:6006` api, `:6000` app |

Do not `replace-image`.

## Orin leftovers

- `icarus-app` / `icarus-server` — **stopped**. Hostnames `icarus.aerekos.com` / `icarusapi.aerekos.com` now hit Cloud tasks on prod-mini. Leave the Orin containers stopped.
- `aerekos-vllm` — do not clone via compute scale. Start only on Orin; if it OOMs (exit 137), leave it stopped.
- No `mc` / `oc` containers found.

## Docunu

Project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` is hidden from the console. Do not migrate, delete, or CI it. e2e `prodGuard` still skips it.

## Registry

`aerekos-secondary-registry-dashboard` on dev-mini `:8877` is a dashboard, not `registry:2`. Point `INTERNAL_REGISTRY` at a LAN `registry:2` (`:5050`) when CI must place `aer-cmp-*` on a remote worker. Do not mint or Cloudflare-expose `:5050`.
