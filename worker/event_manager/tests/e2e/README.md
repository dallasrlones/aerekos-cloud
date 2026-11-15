# event_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy:** not run in this closeout — needs a running conductor + enabled `event_manager` on a non-prod project (and peer managers for live queue/function/websocket/iot fan-out). Root `e2e/catalog.js` already lists CRUD for `event_manager` / `buses` on port `3132`.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.
