# crawler_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy:** not run in this closeout — needs a running conductor + enabled `crawler_manager` on a non-prod project (and network egress for live `run` / canary). Root `e2e/catalog.js` already lists CRUD for `crawler_manager` / `jobs` on port `3121`.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.
