# Key Manager Service (KMS) - Implementation Prompt

## Your Mission

Implement the **Key Manager Service (KMS)** according to the detailed plan in `plan.md`. This is a critical foundation service for aerekos-cloud that provides enterprise-grade key management for encryption across the platform.

## Context

You are implementing this service **in parallel** with `storage_manager` and `db_manager`. This means:
- **storage_manager** will stub/mock your API calls during development - that's fine!
- **db_manager** is independent - no dependencies
- You are the **foundation service** - other services depend on you

## Key Requirements

### Architecture
- **Master Key Encryption**: Keys encrypted with master key from USB flash drive
- **Key Lifecycle Management**: Create, rotate, archive, delete keys
- **Key Versioning**: Support multiple versions of keys for rotation
- **Service-to-Service Auth**: Authentication via conductor tokens
- **USB Flash Drive**: Master key loaded from USB on startup (with dev fallback)

### Critical Rules
1. **MUST use aerekos-record** for ALL database models (npm package `aerekos-record`, already in this service’s `package.json`)
2. **MUST auto-register** with conductor on startup via `POST /api/services/register`
3. **MUST implement** health checks (`/health`, `/ready`)
4. **MUST follow** the service/repository pattern (Routes → Services → Repositories)
5. **MUST handle** USB flash drive mounting/unmounting in entrypoint script
6. **MUST encrypt** all keys with master key before storage

## Implementation Strategy

### Phase 1: Setup & Configuration
1. Set up project structure (see `plan.md` Phase 1)
2. Create Docker setup with USB device mounting
3. Create entrypoint script for USB master key loading
4. Set up environment configuration

### Phase 2: Database Setup
1. Use SQLite directly (see `plan.md` Phase 2.1)
2. Create Key and KeyAccess models using aerekos-record
3. Initialize database on first startup

### Phase 3: Core Key Management
1. Implement KeyService with encryption/decryption
2. Implement KeyRepository for data access
3. Implement master key encryption/decryption logic
4. Handle key rotation and versioning

### Phase 4: API Endpoints
1. Implement all key CRUD endpoints
2. Implement key rotation endpoint
3. Implement service registration
4. Implement authentication middleware

### Phase 5: Health Checks & Monitoring
1. Implement `/health` endpoint
2. Implement `/ready` endpoint (check master key loaded)
3. Implement `/metrics` endpoint

### Phase 6: Testing
1. Write comprehensive unit tests
2. Write integration tests
3. Test USB mounting (mock)
4. Test encryption/decryption

### Phase 7: Documentation
1. Complete OpenAPI specification
2. Write README with setup instructions

## USB Flash Drive Handling

The entrypoint script (`scripts/docker-entrypoint.sh`) must:
1. Detect USB device (`/dev/usb` or similar)
2. Mount USB drive
3. Read `master.key` file
4. Unmount USB drive (for security)
5. Set `MASTER_KEY` environment variable
6. Fallback to env var or dev key if USB not present

See `plan.md` Phase 1.4 for complete entrypoint script example.

## Master Key Format

- **Format**: Hex string (64 characters for 256-bit key)
- **Example**: `a1b2c3d4e5f6...` (32 bytes = 64 hex chars)
- **Storage**: Never log or expose the master key
- **Dev Fallback**: Use `dev-master-key-change-in-production` if USB not available

## Files to Reference

1. **`plan.md`** - Your complete implementation guide (read this first!)
2. **`../../new_service.md`** - Best practices for creating services
3. **`../../conductor/api/models/index.js`** - Example of aerekos-record model usage
4. **`../../worker/index.js`** - Example of service registration pattern

## Implementation Checklist

Follow `plan.md` phases in order:

- [ ] Phase 1: Initial Setup & Configuration
- [ ] Phase 2: Database Setup (SQLite)
- [ ] Phase 3: Core Key Management
- [ ] Phase 4: API Endpoints
- [ ] Phase 5: Health Checks & Monitoring
- [ ] Phase 6: Testing
- [ ] Phase 7: Documentation

## Important Notes

1. **Service Registration**: The conductor service registry endpoint (`POST /api/services/register`) may not exist yet. If it doesn't, implement a temporary workaround or note it in your implementation.

2. **Database**: Use SQLite directly (see `plan.md` Phase 2.1). This is a small, local database - perfect for key storage.

3. **Encryption**: All keys stored in database MUST be encrypted with the master key. Never store plaintext keys.

4. **Key Material**: When returning keys to other services, decrypt the key material and return it (see `plan.md` "How Other Services Use key_manager" section).

5. **Testing**: Write comprehensive tests. Mock USB mounting in tests.

6. **Error Handling**: Handle USB mounting failures gracefully (fallback to env var or dev mode).

## Success Criteria

Your implementation is complete when:
- ✅ All API endpoints work (create, get, list, rotate, delete keys)
- ✅ Keys are encrypted with master key before storage
- ✅ Keys can be decrypted and returned to services
- ✅ USB flash drive mounting works (with fallbacks)
- ✅ Service auto-registers with conductor
- ✅ Health checks work (including master key check)
- ✅ Comprehensive tests pass
- ✅ OpenAPI spec is complete

## Questions?

- Check `plan.md` first - it has detailed examples and code templates
- Check `../../new_service.md` for service creation patterns
- If stuck, note it in comments and continue - we can refine later

## Ready?

Start with Phase 1 in `plan.md` and work through each phase systematically. The plan has detailed code examples and templates - follow them closely.

**Remember**: You're the foundation service. Other services are waiting for you! 🚀

