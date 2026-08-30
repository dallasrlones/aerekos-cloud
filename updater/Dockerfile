# aerekos-updater — the per-device "pull from conductor and redeploy" sidecar.
# It talks to the host Docker daemon over the mounted socket and runs
# `docker compose` for the rest of the stack, so it can update siblings without
# updating (and killing) itself.
FROM docker:cli

RUN apk add --no-cache docker-cli-compose curl bash tar coreutils jq

COPY update-loop.sh /usr/local/bin/update-loop.sh
RUN chmod +x /usr/local/bin/update-loop.sh

ENTRYPOINT ["/usr/local/bin/update-loop.sh"]
