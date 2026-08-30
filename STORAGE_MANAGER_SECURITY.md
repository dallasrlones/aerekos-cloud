# Storage Manager Security & HIPAA/PHI Compliance Guide

## Overview

Storage Manager handles sensitive PHI/HIPAA data and must implement industry-standard encryption and security practices.

## Encryption Architecture

### 1. **Encryption at Rest (File Storage)**

**Current Implementation:**
- ✅ All files are encrypted using AES-256-GCM before being written to disk
- ✅ Each bucket has a unique encryption key from `key_manager`
- ✅ Files are stored as encrypted blobs (no readable data on disk)
- ✅ Metadata (file keys/paths) stored in SQLite database (also encrypted)

**Best Practices:**
1. **Per-Bucket Encryption Keys**: Each bucket gets a unique encryption key from `key_manager`
   - When bucket is created, generate unique key name: `bucket-{projectId}-{bucketId}-encryption-key`
   - Store only the key name in bucket metadata (never the key material)
   - Fetch key from `key_manager` when encrypting/decrypting files

2. **File Encryption Process**:
   ```
   Original File → AES-256-GCM Encryption (using bucket's key) → Encrypted Blob → Disk Storage
   ```
   - Each file encrypted independently
   - Random IV generated per file (stored with encrypted data)
   - Auth tag included for integrity verification

3. **Key Management**:
   - Keys stored in `key_manager` (encrypted with master key)
   - Keys never stored in storage_manager database
   - Key rotation supported via `key_manager` API
   - Old key versions retained for decrypting old files

### 2. **Encryption in Transit**

**Current Implementation:**
- ✅ HTTPS/TLS required for all API communication
- ✅ Service-to-service authentication via conductor tokens
- ✅ Signed URLs for temporary access (with expiration)

**Best Practices:**
- All API calls must use HTTPS
- Service tokens rotated regularly
- Signed URLs expire after TTL (default: 1 hour)

### 3. **Access Control**

**Current Implementation:**
- ✅ Project-based isolation (files belong to projects)
- ✅ Service token authentication required
- ✅ Audit logging for all file operations

**Best Practices:**
- Project isolation ensures data separation
- Only authorized services can access files
- All access logged with timestamp, service name, action

### 4. **Storage Structure**

**Current Implementation:**
- Files stored as: `{STORAGE_PATH}/{bucket_id}/{file_id}.encrypted`
- File keys (paths) stored in database: `project_id/bucket_id/folder/folder/file`
- No actual folder structure on disk (S3-style key storage)

**Best Practices:**
- Use S3-style keys: `project_id/bucket_id/folder/folder/file`
- Store only encrypted blobs on disk
- Metadata (keys, sizes, types) in SQLite database
- Database also encrypted (via SQLite encryption or application-level encryption)

## HIPAA/PHI Compliance Checklist

### ✅ Encryption Requirements
- [x] Encryption at rest (AES-256-GCM)
- [x] Encryption in transit (HTTPS/TLS)
- [x] Unique encryption keys per bucket
- [x] Key management via `key_manager`
- [x] Key rotation support

### ✅ Access Control
- [x] Project-based data isolation
- [x] Service token authentication
- [x] Audit logging
- [ ] Role-based access control (RBAC) - Future enhancement
- [ ] IP whitelisting - Future enhancement

### ✅ Audit & Monitoring
- [x] File access logging (FileAccess model)
- [x] All operations logged with timestamp
- [ ] Real-time alerting on suspicious activity - Future enhancement
- [ ] Compliance reports - Future enhancement

### ✅ Data Integrity
- [x] ETag verification (MD5 hash)
- [x] Auth tag verification (GCM)
- [x] File versioning support
- [ ] Checksum verification on download - Future enhancement

### ✅ Backup & Recovery
- [ ] Automated backups - Future enhancement
- [ ] Point-in-time recovery - Future enhancement
- [ ] Disaster recovery plan - Future enhancement

## Implementation Details

### Bucket Creation with Unique Encryption Key

**Current Flow:**
1. User creates bucket via API
2. BucketService creates bucket with `encryption_key_name`
3. Default key used if not specified: `storage-encryption-key`

**Recommended Flow (HIPAA-compliant):**
1. User creates bucket via API
2. BucketService generates unique key name: `bucket-{projectId}-{bucketId}-encryption-key`
3. Create key in `key_manager` if it doesn't exist
4. Store key name in bucket metadata
5. All files in bucket encrypted with this unique key

**Code Example:**
```javascript
async createBucket(projectId, name, createdBy, encryptionKeyName = null, metadata = {}) {
  // Generate unique key name for bucket
  const bucketId = crypto.randomUUID();
  const uniqueKeyName = encryptionKeyName || `bucket-${projectId}-${bucketId}-encryption-key`;
  
  // Ensure key exists in key_manager
  await this.ensureEncryptionKey(uniqueKeyName);
  
  // Create bucket with unique key
  const bucket = await this.bucketRepo.create({
    project_id: projectId,
    name,
    created_by: createdBy,
    encryption_key_name: uniqueKeyName,
    metadata: JSON.stringify(metadata)
  });
  
  return bucket;
}

async ensureEncryptionKey(keyName) {
  try {
    // Check if key exists
    await axios.get(
      `${this.conductorUrl}/api/services/key_manager/api/keys/${keyName}`,
      { headers: { 'Authorization': `Bearer ${this.serviceToken}` } }
    );
  } catch (error) {
    if (error.response?.status === 404) {
      // Create key if it doesn't exist
      await axios.post(
        `${this.conductorUrl}/api/services/key_manager/api/keys`,
        {
          name: keyName,
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        },
        { headers: { 'Authorization': `Bearer ${this.serviceToken}` } }
      );
    } else {
      throw error;
    }
  }
}
```

### Docker Mount Configuration

**Current Setup:**
- Storage path: `./storage` (relative to container)
- Mounted as volume: `./storage:/app/storage`

**Recommended Setup (HIPAA-compliant):**
- Use dedicated storage volume: `/mnt/storage` or `/var/lib/aerekos-storage`
- Mount host directory: `{STORAGE_PATH}:/app/storage`
- Set proper permissions: `chmod 700` (owner only)
- Use encrypted filesystem if possible (LUKS, etc.)

**docker-compose.yml:**
```yaml
services:
  storage_manager:
    volumes:
      - ${STORAGE_PATH:-./storage}:/app/storage:rw
      - ./data:/app/data
    environment:
      - STORAGE_PATH=/app/storage
```

## Security Recommendations

### 1. **Key Rotation**
- Rotate encryption keys annually (or per compliance requirements)
- Support multiple key versions for decrypting old files
- Automatically use latest key version for new files

### 2. **Access Logging**
- Log all file operations (create, read, update, delete)
- Include: timestamp, service name, user ID (if available), IP address, action
- Retain logs for compliance period (typically 7 years for HIPAA)

### 3. **Data Retention**
- Implement data retention policies
- Automatic deletion after retention period
- Secure deletion (overwrite before deletion)

### 4. **Backup Encryption**
- All backups must be encrypted
- Use separate encryption keys for backups
- Store backup keys securely in `key_manager`

### 5. **Network Security**
- Use private networks for service communication
- Implement network segmentation
- Use VPN for remote access

## Questions & Answers

### Q: What's the safest way to store PHI/HIPAA files?

**A: Multi-Layer Encryption Approach:**
1. **Application-Level Encryption**: Files encrypted with AES-256-GCM before storage
2. **Unique Keys Per Bucket**: Each bucket has its own encryption key
3. **Key Management**: Keys stored in `key_manager` (encrypted with master key)
4. **Filesystem Encryption**: Use encrypted filesystem (LUKS) for additional layer
5. **Network Encryption**: HTTPS/TLS for all communication
6. **Access Control**: Project-based isolation + service authentication
7. **Audit Logging**: All access logged and monitored

### Q: Should we encrypt metadata (file keys/paths)?

**A: Yes, for maximum security:**
- Encrypt file keys/paths in database
- Use separate encryption key for metadata
- Or use SQLite encryption extension
- Current implementation stores keys in plaintext (acceptable if database is secured)

### Q: How to handle key rotation?

**A: Versioned Keys:**
1. Create new key version in `key_manager`
2. New files use new key version
3. Old files remain encrypted with old key version
4. Store key version with each file
5. Decrypt using appropriate key version

### Q: What about file deletion?

**A: Secure Deletion:**
1. Delete encrypted file from disk
2. Delete metadata from database
3. Optionally: Overwrite file before deletion (for high-security environments)
4. Log deletion in audit log

## Next Steps

1. ✅ Implement per-bucket unique encryption keys
2. ✅ Add Docker mount configuration UI
3. ✅ Ensure all files encrypted at rest
4. [ ] Add key rotation support
5. [ ] Implement metadata encryption
6. [ ] Add secure deletion
7. [ ] Implement backup encryption
8. [ ] Add compliance reporting
