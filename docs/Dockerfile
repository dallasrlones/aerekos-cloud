# Static web docs for aerekos-cloud.
# Build context MUST be the repo root so the generated docs/site is available:
#   docker build -f docs/Dockerfile -t aerekos-docs .
# Generate the site first with `make docs` (writes docs/site/).
FROM nginx:1.27-alpine
COPY docs/site /usr/share/nginx/html
EXPOSE 80
