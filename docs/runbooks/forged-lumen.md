# forged-lumen on aerekos-git

Source: `/Users/dallaslones/work/forged_lumen`.

Cloud-owned on the **dev-mini** worker (`pin_worker_id` `aceb538e-b987-48da-a2ba-d3c933e823df`). Compose `forged-lumen-api-prod` / `forged-lumen-web-prod` is stopped. Do not mint a tunnel. Do not relocate to prod-mini.

Existing Cloudflare hostnames on the **dev-mini** tunnel (merge-attached, same ports):

- `forgedlumen.com` → web `:49232`
- `api.forgedlumen.com` → api `:49231`

API data bind stays on the device: `/home/aerekos/work/forged_lumen/server/data` → `/app/data`.

## Live IDs

| What | Value |
|------|--------|
| Project | `31ba7966-ba43-4e64-b30d-872fac3c9f53` (`forged-lumen`) |
| Repo | `86391498-e507-477c-b595-b73f913fa3ef` |
| Task API | `5e82177b-7ba1-4cfc-8e6a-310ffbd6bff0` (`aer-cmp-5e82177b7ba1-forged-lumen-api`) |
| Task web | `9b931e18-3f66-4fa6-a584-3ccdfbfcffed` (`aer-cmp-9b931e183f66-forged-lumen-web`) |
| Pipeline API | `8f205b85-b2d6-4836-b36a-8e62ee3e1ffe` (`server/Dockerfile`) |
| Pipeline web | `adf578c1-9c81-4fe4-b7bc-e5b803924b86` (`web/Dockerfile`) |

Never create an unpinned forged task (empty pin lands on prod-mini).

## Git + CI

- Origin: `https://git.aerekos.com/forged-lumen.git`
- Two pipelines, same `repo_name` / `repo_id`, `environment=prod`, `git_ref=main`, `require_pr=false`
- Each pipeline has `target_container_id` + `pin_worker_id` + hostname/port
- Feature-branch pushes skip deploy. Push to `main` tests then replace-image on the pinned worker
- Remote place pulls (or uses a local image) on dev-mini. CI `aer-cmp-*` images need `INTERNAL_REGISTRY` or a load on that worker
