# host_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy:** not run in this closeout — needs a running conductor + enabled `host_manager` on a non-prod project. Live `POST /api/v1/sync` also needs conductor `/api/workers`. Root `e2e/catalog.js` already lists CRUD for `host_manager` / `hosts` on port `3122`.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.
