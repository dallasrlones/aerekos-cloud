# MOCK_KEY_MANAGER=false (prod path)

For shared / GA appliances, storage and secrets must talk to a real `key_manager`, not the in-process mock.

## Compose

```bash
MOCK_KEY_MANAGER=false
# key_manager reachable via SERVICE_DIRECT_HOSTS or same docker network
```

Verify:

```bash
curl -sf "$CONDUCTOR_URL/api/services/key_manager/api/v1/info"
# storage encrypt/decrypt path should not log mock-key warnings
```

Local golden-path may keep `MOCK_KEY_MANAGER=true` for laptop-only demos.
