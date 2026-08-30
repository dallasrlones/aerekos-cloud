# storage_manager — production plan (pro)

**Port:** 3003 · **AWS analog:** S3 · **Category:** Core · **Tier:** production-ready → **pro**

**Navigation:** [← secrets_manager](./secrets_manager.md) · [Index](./README.md) · [MASTER_TODOS.md](./MASTER_TODOS.md) · [edge_stack_pro](./edge_stack_pro.md) · [db_manager →](./db_manager.md)  
**Todos:** `pro-storage-1` · `pro-storage-2` · `pro-storage-3` (detail: pro-storage-1–23 below)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Object storage: buckets, envelope encryption (key_manager), streaming upload, chunked uploads, signed URLs. Strongest core manager — elevate to **S3 pro bar**.

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready (encryption, multipart, signed URLs, e2e) |
| Console UI | StorageManager bespoke |
| Tests | 10+ files incl. `storageFlow.test.js` |
| Auth | Writes gated; **list/read weak**; direct port bypass |
| App-access ARN | Not implemented |

---

## Pro production checklist

### Security & auth (P1)
- [ ] **pro-storage-1** `requireAuth` on **all** routes (direct + proxy)
- [ ] **pro-storage-2** ARN on bucket create: `arn:aerekos:{pid}:storage:bucket/{name}`
- [ ] **pro-storage-3** `requireResource` + scopes on every object op
- [ ] **pro-storage-4** Bucket policies JSON (allow/deny by ARN/credential prefix)
- [ ] **pro-storage-5** CORS configuration per bucket (console + API)
- [ ] **pro-storage-6** Signed URL TTL caps + audit log for upload/download URLs
- [ ] **pro-storage-7** `MOCK_KEY_MANAGER=false` in prod; KMS path only

### S3 feature parity (P2)
- [ ] **pro-storage-8** Object versioning (optional per bucket)
- [ ] **pro-storage-9** Lifecycle rules (expire old versions, transition metadata)
- [ ] **pro-storage-10** Multipart upload **resume** + list parts
- [ ] **pro-storage-11** Object metadata headers (Content-Type, Cache-Control)
- [ ] **pro-storage-12** Bucket encryption default enforced (cannot disable)
- [ ] **pro-storage-13** Soft delete bucket (30-day recovery per E6)
- [ ] **pro-storage-14** Per-bucket quotas (size/object count) — ties to E8

### Operations (P2)
- [ ] **pro-storage-15** Conductor DB backup target bucket (document + automate E11)
- [ ] **pro-storage-16** Metrics: bytes stored, object count, upload/download rate on `/metrics`
- [ ] **pro-storage-17** Rate limits per app credential on PUT/GET

### Console & CLI (P2)
- [ ] **pro-storage-18** App access card (ARN, cred, curl, Copy CLI)
- [ ] **pro-storage-19** Setup wizard: deps key_manager → first bucket → test upload
- [ ] **pro-storage-20** Lifecycle + versioning UI on BucketDetails
- [ ] **pro-storage-21** `aerekos storage buckets …` full parity

### Testing (P2)
- [ ] **pro-storage-22** e2e: app credential scoped to one bucket only
- [ ] **pro-storage-23** Integration: 401/403 on all routes when `AUTH_REQUIRED=true`

---

## App access

| Field | Value |
|-------|-------|
| ARN | `arn:aerekos:{pid}:storage:bucket/{name}` |
| Scopes | `storage:GetObject`, `storage:PutObject`, `storage:ListBucket`, `storage:DeleteObject` |

---

## Dependencies (setup wizard)

```
key_manager (MASTER_KEY) → secrets_manager (optional) → storage_manager
```

---

## Links

- [edge_stack_pro.md](./edge_stack_pro.md) — backup bucket use case
- [worker/storage_manager/plan.md](../../worker/storage_manager/plan.md)
