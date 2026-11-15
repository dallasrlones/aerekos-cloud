# registry_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy:** not run in this closeout — needs a running conductor + enabled `registry_manager` on a non-prod project. Root `e2e/catalog.js`, `e2e/run.js` (rich CRUD), and `e2e/wave2-registry.js` already cover proxy scenarios when the stack is up.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.
