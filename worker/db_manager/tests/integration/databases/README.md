# Engine integration tests (full stack)

These files call **a live conductor** (default `http://localhost:3000`) and expect **db_manager** (and often Docker + engines) to be up. They are **not** part of the default Jest run.

- **Default CI / local unit run:** `npm test` in `worker/db_manager` (skips this folder).
- **Manual full run:** `npm run test:integration` (sets `DB_MANAGER_INTEGRATION=1`, `runInBand`, only `tests/integration/databases/`).

Set `CONDUCTOR_URL` / `API_BASE_URL` / `TEST_PROJECT_ID` as needed. Admin login defaults to `admin`/`admin` where the test uses that.

If Jest errors with “circular structure to JSON”, it is often a rich **axios** error being serialized; prefer fixing assertions or use `--runInBand` (already set on `test:integration`).
