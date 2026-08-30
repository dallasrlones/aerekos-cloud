# git_manager — E2E checklist

These validate the **real** git transport (the unit/integration suite runs in `SKIP_GIT` mode).

## Quick standalone round-trip (no conductor)

```bash
# 1. Build + run the image (git is baked in)
docker build -f worker/git_manager/Dockerfile -t aerekos-git_manager worker/
docker run -d --name git_test -e SKIP_SERVICE_REGISTRATION=true -e PORT=3130 -p 3130:3130 aerekos-git_manager

# 2. Create a repo via the control plane
curl -s -X POST http://localhost:3130/api/v1/repos \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"demo","name":"hello"}'

# 3. Real clone -> commit -> push -> pull
git clone http://localhost:3130/git/demo/hello.git /tmp/hello
cd /tmp/hello && echo "# hello" > README.md
git add . && git -c user.email=e2e@x -c user.name=e2e commit -m init
git push origin HEAD:main
git clone http://localhost:3130/git/demo/hello.git /tmp/hello2   # should contain README.md

# 4. Push was recorded by the post-receive hook
#    (repo id from step 2 response)
curl -s "http://localhost:3130/api/v1/repos/<id>/pushes?project_id=demo"

docker rm -f git_test
```

## Full stack (through the conductor)

`make up` then:

```bash
node e2e/run.js   # Tier 3 covers repo CRUD; Tier 5 does a live clone/push/pull
```

Tier 5 hits `GIT_MANAGER_URL` (default `http://localhost:3130`) directly because the conductor
proxy does not stream git transport. It is non-fatal: it warns if `git` is not on PATH.
