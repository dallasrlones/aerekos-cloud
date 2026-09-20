#!/usr/bin/env bash
# scripts/deploy/provision-cf-service-token.sh
#
# Creates a Cloudflare Access *service token* and attaches it to the SSH Access
# applications (prod/dev/orin/pi4 .aerekos.com) so that SSH — and CI — can
# authenticate to those hosts non-interactively, forever, with no browser.
#
# This fixes the "why do I have to re-auth Cloudflare Access every time" problem:
# the token below replaces the short-lived browser session.
#
# Prereqs:
#   • Run from a network that can actually reach api.cloudflare.com (the
#     diagnostics on 2026-06-05 showed some networks block TLS to Cloudflare).
#   • export CLOUDFLARE_API_TOKEN=...   (source ~/work/cloudflare/env.sh)
#     The token needs: Account › Access: Apps and Policies › Edit
#                      Account › Access: Service Tokens › Edit
#
# Usage:
#   source ~/work/cloudflare/env.sh
#   bash scripts/deploy/provision-cf-service-token.sh
#   bash scripts/deploy/provision-cf-service-token.sh --hosts prod.aerekos.com,dev.aerekos.com
#
# On success it prints the client id + secret ONCE (the secret is never
# retrievable again) plus an ~/.ssh/config snippet to paste in.
set -euo pipefail

HOSTS="${AEREKOS_SSH_HOSTS:-prod.aerekos.com,dev.aerekos.com,orin.aerekos.com,pi4.aerekos.com}"
TOKEN_NAME="${AEREKOS_SERVICE_TOKEN_NAME:-aerekos-ci-ssh}"

while [ $# -gt 0 ]; do
  case "$1" in
    --hosts) HOSTS="$2"; shift 2;;
    --name)  TOKEN_NAME="$2"; shift 2;;
    -h|--help) sed -n '2,30p' "$0"; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || {
  echo "✗ CLOUDFLARE_API_TOKEN not set. Run: source ~/work/cloudflare/env.sh" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "✗ python3 required." >&2; exit 1; }

AEREKOS_SSH_HOSTS="$HOSTS" AEREKOS_SERVICE_TOKEN_NAME="$TOKEN_NAME" python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error

API = "https://api.cloudflare.com/client/v4"
TOK = os.environ["CLOUDFLARE_API_TOKEN"]
HOSTS = [h.strip() for h in os.environ["AEREKOS_SSH_HOSTS"].split(",") if h.strip()]
NAME = os.environ["AEREKOS_SERVICE_TOKEN_NAME"]

def call(method, path, body=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {TOK}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        sys.exit(f"✗ {method} {path} → HTTP {e.code}\n{detail}")
    except Exception as e:  # noqa
        sys.exit(f"✗ {method} {path} failed: {e}\n"
                 "  (Can this machine reach api.cloudflare.com? Some networks block TLS to Cloudflare.)")

def ok(resp, what):
    if not resp.get("success", False):
        sys.exit(f"✗ {what}: {json.dumps(resp.get('errors'))}")
    return resp["result"]

# 1. account
accts = ok(call("GET", "/accounts"), "list accounts")
if not accts:
    sys.exit("✗ No accounts visible to this token.")
acct = accts[0]["id"]
print(f"▶ Account: {accts[0]['name']} ({acct})")

# 2. create the service token (secret returned ONCE, here)
print(f"▶ Creating service token '{NAME}'")
st = ok(call("POST", f"/accounts/{acct}/access/service_tokens", {"name": NAME}),
        "create service token")
client_id = st["client_id"]
client_secret = st["client_secret"]
token_id = st["id"]

# 3. attach a non-identity policy to each matching SSH Access app
apps = ok(call("GET", f"/accounts/{acct}/access/apps"), "list Access apps")
def app_domains(a):
    ds = set()
    if a.get("domain"): ds.add(a["domain"])
    for d in a.get("self_hosted_domains") or []:
        ds.add(d)
    return ds

attached, missing = [], []
for host in HOSTS:
    match = next((a for a in apps if host in app_domains(a)), None)
    if not match:
        missing.append(host); continue
    app_id = match["id"]
    # Policy precedences must be unique within an app, so append after the
    # highest existing one instead of assuming slot 1 is free.
    existing = ok(call("GET", f"/accounts/{acct}/access/apps/{app_id}/policies"),
                  f"list policies for {host}") or []
    next_prec = max([p.get("precedence", 0) for p in existing], default=0) + 1
    policy = {
        "name": f"{NAME} (service token)",
        "decision": "non_identity",
        "include": [{"service_token": {"token_id": token_id}}],
        "precedence": next_prec,
    }
    ok(call("POST", f"/accounts/{acct}/access/apps/{app_id}/policies", policy),
       f"add policy to {host}")
    attached.append(host)
    print(f"  ✓ {host} → policy attached")

for host in missing:
    print(f"  ! {host} → no Access app found (skipped)")

print("\n" + "=" * 64)
print("SAVE THESE NOW — the secret is shown only once:")
print(f"  CF_ACCESS_CLIENT_ID     = {client_id}")
print(f"  CF_ACCESS_CLIENT_SECRET = {client_secret}")
print("=" * 64)
print("""
1) Local SSH (auth once, forever) — add to ~/.ssh/config under each host,
   replacing the existing ProxyCommand line:

     ProxyCommand /opt/homebrew/bin/cloudflared access ssh --hostname %h \\
       --service-token-id  {cid} \\
       --service-token-secret {csec}

   Then `ssh prod.aerekos.com` will never prompt for a browser login again.

2) GitHub Actions (if you ever switch to the SSH-based deploy): add the two
   values above as repo secrets CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET.
""".format(cid=client_id, csec=client_secret))
PY
