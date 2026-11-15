# MOCK_KEY_MANAGER=false (prod path)

For shared / GA appliances, storage and secrets must talk to a real `key_manager`, not the in-process mock.

## Compose

```bash
MOCK_KEY_MANAGER=false
# key_manager reachable via SERVICE_DIRECT_HOSTS or same docker network
# key_manager listens on 3102 (conductor managerServicePorts)
```

Verify:

```bash
curl -sf "$CONDUCTOR_URL/api/services/key_manager/health"
curl -sf "$CONDUCTOR_URL/api/services/key_manager/ready"
# optional: list keys (needs JWT / service token + project_id as required by caller)
# curl -sf -H "Authorization: Bearer $TOKEN" \
#   "$CONDUCTOR_URL/api/services/key_manager/api/keys?project_id=$PID"
# storage encrypt/decrypt path should not log mock-key warnings
```

Local golden-path may keep `MOCK_KEY_MANAGER=true` for laptop-only demos. Never enable the consumer mock when `NODE_ENV=production`.
