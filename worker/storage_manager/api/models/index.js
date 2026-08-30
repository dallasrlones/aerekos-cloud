const { getDatabase } = require('../utils/dbClient');

// Database will be initialized on first access
let db = null;
let cachedModels = null;

/**
 * Initialize models (call this after database is connected)
 */
async function initializeModels() {
  if (cachedModels) {
    return cachedModels;
  }
  
  db = await getDatabase();
  
  // Project Model (top level)
  const Project = db.model('Project', {
    name: 'string',
    created_by: 'string',  // Service that created project
    metadata: 'string'  // JSON string for additional metadata
  }, {
    required: ['name'],
    unique: ['name'],
    timestamps: true,
    hasMany: ['Bucket']  // Projects have many buckets
  });
  
  // Bucket Model (belongs to Project)
  const Bucket = db.model('Bucket', {
    name: 'string',
    created_by: 'string',  // Service that created bucket
    encryption_key_name: 'string',  // Key name from key_manager (all files encrypted)
    metadata: 'string'  // JSON string for additional metadata
  }, {
    required: ['name'],
    // Do not use unique: ['project_id','name'] — adapter creates two single-column uniques
    // (one bucket per project / global bucket name). Enforce name uniqueness per project in services.
    belongsTo: ['Project'],  // Creates project_id foreign key automatically
    hasMany: ['File'],  // Buckets have many files
    timestamps: true
  });
  
  // File Model (belongs to Bucket, which belongs to Project)
  const File = db.model('File', {
    key: 'string',  // File key/path within bucket
    size: 'number',  // File size in bytes
    content_type: 'string',  // MIME type
    etag: 'string',  // ETag for versioning
    encryption_key_version: 'number',  // Key version used for encryption
    storage_path: 'string',  // Physical encrypted file path
    chunk_count: 'number',  // Number of chunks (for chunked uploads)
    chunk_size: 'number',  // Size of each chunk in bytes
    upload_id: 'string',  // Multipart upload ID (for chunked uploads)
    upload_status: 'string',  // 'pending', 'in_progress', 'completed', 'failed'
    metadata: 'string'  // JSON string for custom metadata
  }, {
    required: ['key', 'size', 'storage_path'],
    // aerekos-record SQLite adapter treats each unique entry as one column; composite
    // [['bucket_id','key']] becomes invalid SQL. Enforce per-bucket key uniqueness in services.
    belongsTo: ['Bucket'],  // Creates bucket_id foreign key automatically
    timestamps: true
  });
  
  // FileChunk Model (for chunked uploads)
  const FileChunk = db.model('FileChunk', {
    chunk_number: 'number',  // Chunk sequence number (1, 2, 3, ...)
    chunk_path: 'string',  // Physical path to encrypted chunk
    chunk_size: 'number',  // Size of this chunk
    etag: 'string',  // ETag for this chunk
    upload_status: 'string'  // 'pending', 'uploaded', 'completed'
  }, {
    required: ['chunk_number', 'chunk_path'],
    // Do not use unique: ['file_id','chunk_number'] here — adapter creates two single-column
    // unique indexes (wrong). Composite (file_id, chunk_number) not supported by adapter.
    belongsTo: ['File'],  // Creates file_id foreign key automatically
    timestamps: true
  });
  
  // SignedUrl Model (for signed upload/download URLs)
  const SignedUrl = db.model('SignedUrl', {
    url_type: 'string',  // 'upload' or 'download'
    url: 'string',  // The signed URL
    expires_at: 'datetime',  // TTL expiration time
    used: 'number',  // 0 = false, 1 = true (track if URL was used)
    used_at: 'datetime',  // When URL was used (nullable)
    metadata: 'string'  // JSON string for additional data
  }, {
    required: ['url_type', 'url', 'expires_at'],
    belongsTo: ['File', 'Bucket'],  // Creates file_id and bucket_id foreign keys automatically
    timestamps: true
  });
  
  // FileAccess Model (audit log)
  const FileAccess = db.model('FileAccess', {
    service_name: 'string',
    action: 'string',  // 'get', 'put', 'delete', 'list', 'upload_chunk', 'download'
    timestamp: 'datetime',
    ip_address: 'string',
    success: 'number'  // 0 = false, 1 = true
  }, {
    required: ['service_name', 'action', 'timestamp'],
    belongsTo: ['File'],  // Creates file_id foreign key automatically
    timestamps: false  // We use timestamp field instead
  });
  
  cachedModels = {
    Project,
    Bucket,
    File,
    FileChunk,
    SignedUrl,
    FileAccess,
    db
  };
  
  return cachedModels;
}

// Lazy initialization - models will be created on first access
let modelsPromise = null;

async function getModels() {
  // If models are already cached, return them immediately
  if (cachedModels) {
    return cachedModels;
  }
  
  // Otherwise, initialize them (or wait for existing initialization)
  if (!modelsPromise) {
    modelsPromise = initializeModels();
  }
  
  const models = await modelsPromise;
  if (!models) {
    throw new Error('Failed to initialize models. Database may not be connected.');
  }
  return models;
}

module.exports = { getModels, initializeModels };
