# Local registry:2

Run a pull-through registry on a worker (not on the public internet).

```
aerekos call compute_manager POST /api/v1/tasks -P 9d8bde11-6933-4732-b746-602dcf72eaa5 -d '{
  "name": "registry",
  "image": "registry:2",
  "restart": "unless-stopped",
  "port_bindings": { "5000": "5050" },
  "volumes": ["registry-data:/var/lib/registry"]
}'
```

Point `registry_manager` wanted-image pulls at `http://<overlay-or-lan>:5050`. Set `INTERNAL_REGISTRY` on `compute_manager` (for example `192.168.0.141:5050`) so CI `aer-cmp-*` builds are tagged and pushed there; remote `ensureImage` then pulls that ref on the pinned worker. Store pull credentials in secrets_manager as `credential_ref`. Do not expose :5050 on Cloudflare. Each Docker engine that pulls needs that host in `insecure-registries` when the registry is HTTP.
