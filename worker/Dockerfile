FROM node:20-bookworm-slim

WORKDIR /app

# curl for healthchecks; procps/coreutils help host-resource detection
RUN apt-get update && apt-get install -y --no-install-recommends curl procps \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --omit=dev && npm cache clean --force

COPY . .

# aerekos-record bundles a macOS better-sqlite3 binary; re-fetch the Linux prebuild.
RUN npm rebuild better-sqlite3

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/data

EXPOSE 3001

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "index.js"]
