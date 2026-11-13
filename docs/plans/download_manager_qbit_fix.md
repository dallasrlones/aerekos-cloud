# download_manager — qBittorrent auth & 5.2 preferences

> **Status:** Plan — W11 qbit/download e2e  
> **Navigation:** [download_manager service](../services/download_manager.md) · [GA_CHECKLIST § W11](../GA_CHECKLIST.md)

## Symptoms

- `qBittorrent auth failed (HTTP 401)` despite correct-looking env.
- Login works from browser but `download_manager` cannot add torrents.
- qBittorrent **5.2+** Web UI uses a generated admin password shown once as `********` in the UI (not the literal string `admin`).

## Root causes

| Issue | Detail |
|-------|--------|
| Default password | Fresh qBittorrent Docker images ship a **random** Web UI password until you set one in preferences or env. |
| Env drift | `QBITTORRENT_PASS` empty while container was initialized with a different password (stored in `/config/qBittorrent/`). |
| 5.2 cookie | API may return `QBT_SID_<port>` instead of `SID` — handled in `worker/download_manager/api/utils/qbit.js`. |
| 5.2 preferences | Some builds require `POST /api/v2/app/setPreferences` before Web API accepts torrent adds (e.g. disabled embedded tracker, path permissions). |

## Fix procedure

### 1. Read or reset Web UI credentials

```bash
# Inside the qBittorrent container (path may vary by image)
docker exec -it <qbit-container> cat /config/qBittorrent/qBittorrent.conf | grep -E 'WebUI\\Password'
```

Or set a known password via image env (check image docs) and restart qBittorrent once.

### 2. Align download_manager env

On `download_manager` (compose or conductor service env):

```env
QBITTORRENT_URL=http://qbittorrent:8080
QBITTORRENT_USER=admin
QBITTORRENT_PASS=<actual-password-not-asterisks>
QBITTORRENT_SAVE_ROOT=/data/downloads
```

The `***` shown in the qBittorrent UI is a **mask**, not the password value to paste into env.

### 3. Verify login manually

```bash
curl -s -c /tmp/qbit.cookie -X POST "$QBIT_URL/api/v2/auth/login" \
  -d "username=$QBIT_USER&password=$QBIT_PASS"
# Expect body "Ok." or HTTP 204 on 5.x
```

### 4. qBittorrent 5.2 — setPreferences (if adds fail with 403/400)

After login, push minimal preferences (JSON string in form field `json`):

```bash
SID=$(grep -o 'QBT_SID[^=]*=[^;]*' /tmp/qbit.cookie | head -1)
curl -s -b /tmp/qbit.cookie -X POST "$QBIT_URL/api/v2/app/setPreferences" \
  --data-urlencode 'json={"save_path":"/downloads","temp_path_enabled":false,"web_ui_clickjacking_protection_enabled":false}'
```

Adjust `save_path` to match the volume mounted for torrent payload. Re-test:

```bash
curl -s -b /tmp/qbit.cookie "$QBIT_URL/api/v2/app/version"
curl -s -b /tmp/qbit.cookie -X POST "$QBIT_URL/api/v2/torrents/add" \
  -d "urls=magnet:?xt=urn:btih:..." \
  -d "savepath=/downloads"
```

### 5. Wire into download_manager (follow-up code)

- [ ] Optional `QbitClient.setPreferences(prefs)` wrapper calling `/app/setPreferences`.
- [ ] Run preferences once on startup when `QBITTORRENT_BOOTSTRAP_PREFS=1`.
- [ ] Health check: login + `GET /app/version` in `/ready` when `QBITTORRENT_URL` is set.

### 6. E2E smoke

```bash
# Via conductor proxy (project scoped)
curl -s -H "Authorization: Bearer $APP_TOKEN" \
  "$CONDUCTOR/api/services/download_manager/api/v1/lists?project_id=$PID"
```

Add a magnet test item; confirm row reaches `complete` or `error` with qbit hash populated.
