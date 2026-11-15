# sms_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy:** not run in this closeout — needs a running conductor + enabled `sms_manager` on a non-prod project (and Twilio `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` for live send). Root `e2e/catalog.js` already lists CRUD for `sms_manager` / `messages` on port `3114`.

**Blockers for live e2e:** conductor stack not up in this worktree closeout; Twilio provider keys (`needs-keys`); do not hit production project.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.
