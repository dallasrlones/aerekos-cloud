# Build context MUST be conductor/ (see docker-compose.core.yml).
FROM node:20-bookworm-slim

WORKDIR /app

# curl for container healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# ignore-scripts: safe if prepare hooks appear; slim image has no husky
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

COPY . .

# aerekos-record bundles a macOS better-sqlite3 binary; re-fetch the Linux prebuild.
RUN npm rebuild better-sqlite3

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "index.js"]
