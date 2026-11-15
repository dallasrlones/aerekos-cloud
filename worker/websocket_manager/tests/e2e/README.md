# websocket_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy / WSS:** not run in this closeout — needs a running conductor + enabled `websocket_manager` on a non-prod project (and proxy WebSocket upgrade if testing WSS through conductor). Root `e2e/catalog.js` already lists CRUD for `websocket_manager` / `channels` on port `3131`.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.
