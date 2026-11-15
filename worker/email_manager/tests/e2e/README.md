# email_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy:** not run in this closeout — needs a running conductor + enabled `email_manager` on a non-prod project (and SMTP secrets for live send). Root `e2e/catalog.js` already lists CRUD for `email_manager` / `messages` on port `3113`.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.
