# Storage Manager Service - Implementation Prompt

## Your Mission

Implement the **Storage Manager Service** according to the detailed plan in `plan.md`. This is a critical foundation service for aerekos-cloud that provides S3-compatible object storage with automatic encryption, chunked uploads, and signed URLs. The plan also defines a **future** capability: **host drive detection and drive speed** (worker-side discovery + optional benchmarks)—see `plan.md` → *Host drives, devices & performance*.

## Context

You are implementing this service **in parallel** with `key_manager` and `db_manager`. This means:
- **key_manager** is not yet ready - you'll stub/mock its calls during development
- **db_manager** is not yet ready - you can use SQLite fallback initially
- You can implement ~90% of the service independently

## Key Requirements

### Architecture
- **Hierarchy**: Projects → Buckets → Files
- **Automatic Encryption**: Every file MUST be encrypted (use stubbed key_manager calls initially)
- **Chunked Uploads**: Support massive files via chunked/multipart uploads
- **Signed URLs**: Generate time-limited signed URLs for upload/download with TTLs
- **S3-Compatible**: Follow S3 API patterns for easy integration

### Critical Rules
1. **MUST use aerekos-record** for ALL database models (npm package `aerekos-record`, already in this service’s `package.json`)
2. **MUST auto-register** with conductor on startup via `POST /api/services/register`
3. **MUST implement** health checks (`/health`, `/ready`)
4. **MUST follow** the service/repository pattern (Routes → Services → Repositories)
5. **MUST stub key_manager** calls during development (see below)

## Implementation Strategy

### Phase 1: Core Features (Do First)
1. Set up project structure (see `plan.md` Phase 1)
2. Create database models using aerekos-record (Projects, Buckets, Files, FileChunks, SignedUrls)
3. Implement ProjectService, BucketService, StorageService
4. Implement API endpoints for projects, buckets, files
5. Implement chunked upload functionality
6. Implement signed URL generation and validation

### Phase 2: Encryption Integration (After key_manager Ready)
1. Replace stubbed key_manager calls with real API calls
2. Ensure all files are encrypted on upload
3. Ensure all files are decrypted on download

### Stubbing key_manager During Development

In `api/services/EncryptionService.js`, use this pattern:

```javascript
async getEncryptionKey(keyName) {
  // During parallel development - stub key_manager
  if (process.env.MOCK_KEY_MANAGER === 'true' || !process.env.CONDUCTOR_URL) {
    console.warn('[storage_manager] Using mock key_manager - replace with real calls when ready');
    return {
      key_material: 'dev-mock-key-material-change-when-key-manager-ready',
      key_version: 1,
      algorithm: 'AES-256-GCM'
    };
  }
  
  // Real implementation (use when key_manager is ready)
  const response = await axios.get(
    `${process.env.CONDUCTOR_URL}/api/services/key_manager/api/keys/${keyName}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}
```

Set `MOCK_KEY_MANAGER=true` in `.env` during development.

## Files to Reference

1. **`plan.md`** - Your complete implementation guide (read this first!)
2. **`../../new_service.md`** - Best practices for creating services
3. **`../../conductor/api/models/index.js`** - Example of aerekos-record model usage
4. **`../../worker/index.js`** - Example of service registration pattern

## Implementation Checklist

Follow `plan.md` phases in order:

- [ ] Phase 1: Initial Setup & Configuration
- [ ] Phase 2: Database Setup (use SQLite fallback)
- [ ] Phase 3: Core Storage Logic (stub encryption)
- [ ] Phase 4: API Endpoints
- [ ] Phase 5: Health Checks & Monitoring
- [ ] Phase 6: Testing
- [ ] Phase 7: Documentation

## Important Notes

1. **Service Registration**: The conductor service registry endpoint (`POST /api/services/register`) may not exist yet. If it doesn't, implement a temporary workaround or note it in your implementation.

2. **Database**: Use SQLite directly initially (see `plan.md` Phase 2.1 Option B). You can migrate to db_manager later.

3. **Encryption**: Implement encryption logic using stubbed keys. The encryption/decryption code will work the same way - you're just swapping the key source later.

4. **Testing**: Write comprehensive tests. Mock key_manager calls in tests.

5. **Error Handling**: Always handle cases where key_manager might be unavailable gracefully.

## Success Criteria

Your implementation is complete when:
- ✅ All API endpoints work (projects, buckets, files, chunked uploads, signed URLs)
- ✅ Files are encrypted/decrypted (using stubbed keys initially)
- ✅ Chunked uploads work for large files
- ✅ Signed URLs work with TTL expiration
- ✅ Service auto-registers with conductor
- ✅ Health checks work
- ✅ Comprehensive tests pass
- ✅ OpenAPI spec is complete

## Questions?

- Check `plan.md` first - it has detailed examples and code templates
- Check `../../new_service.md` for service creation patterns
- If stuck, note it in comments and continue - we can integrate later

## Ready?

Start with Phase 1 in `plan.md` and work through each phase systematically. The plan has detailed code examples and templates - follow them closely.

Good luck! 🚀

