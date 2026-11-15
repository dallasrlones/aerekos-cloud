# security_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy:** not run in this closeout — needs a running conductor + enabled `security_manager` on a non-prod project. Root `e2e/catalog.js` already lists CRUD for `security_manager` / `findings` on port `3108`.

Live scanners / SIEM are out of scope; `POST /api/v1/findings/scan` is metadata-only.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.
