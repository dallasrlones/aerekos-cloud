# domain_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy:** not run in this closeout — needs a running conductor + enabled `domain_manager` on a non-prod project (and `CLOUDFLARE_API_TOKEN` for live DNS). Root `e2e/catalog.js` / EdgeManager already cover proxy scenarios when the stack is up.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.
