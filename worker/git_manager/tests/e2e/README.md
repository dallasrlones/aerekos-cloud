# E2E — git_manager

Unit/integration run with `SKIP_GIT=1` (metadata only). These steps exercise the **real** git transport and conductor REST proxy.

## Automated (repo root)

Root suite covers repo CRUD via conductor proxy (`e2e/catalog.js` / Tier 3) and live clone/push/pull (Tier 5 against `GIT_MANAGER_URL`, default `http://localhost:3130`):

```bash
# from repo root, stack up
make e2e
# or: node e2e/run.js
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

Tier 5 hits git_manager **directly** because the conductor proxy does not stream Smart HTTP pack bodies. It warns (non-fatal) if `git` is not on PATH.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200 `{ status: "healthy", service: "git_manager" }`
- [ ] **E2E-2:** Conductor registry lists `git_manager`; proxy `/api/services/git_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create repo → list → get → delete via proxy REST
- [ ] **E2E-4:** Direct Smart HTTP: clone → commit → push → pull; `GET /api/v1/repos/:id/pushes` records the push
- [ ] **E2E-5:** SDK `client.svc.git_manager.resource('repos')` / CLI `aerekos git_manager repos …` against a non-prod project

## Quick standalone round-trip (no conductor)

```bash
docker build -f worker/git_manager/Dockerfile -t aerekos-git_manager worker/
docker run -d --name git_test -e SKIP_SERVICE_REGISTRATION=true -e PORT=3130 -p 3130:3130 aerekos-git_manager

curl -s -X POST http://localhost:3130/api/v1/repos \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"demo","name":"hello"}'

git clone http://localhost:3130/git/demo/hello.git /tmp/hello
cd /tmp/hello && echo "# hello" > README.md
git add . && git -c user.email=e2e@x -c user.name=e2e commit -m init
git push origin HEAD:main

docker rm -f git_test
```

## Local smoke (integration-level)

```bash
cd worker/git_manager
npm test   # Node 20
```

Live proxy e2e needs conductor; live clone/push needs the container image (git baked in) or a host with `git` and writable `GIT_REPOS_ROOT`.
