const {
  encryptWithMasterKey,
  decryptWithMasterKey,
  generateKeyMaterial,
  deriveKey,
  hashKey
} = require('../../api/utils/encryption');

describe('Encryption Utilities', () => {
  const masterKey = 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678'; // 64 hex chars = 32 bytes (AES-256)
  
  describe('encryptWithMasterKey and decryptWithMasterKey', () => {
    test('should encrypt and decrypt data correctly', () => {
      const data = 'test-key-material-12345';
      const encrypted = encryptWithMasterKey(data, masterKey);
      const decrypted = decryptWithMasterKey(encrypted, masterKey);
      
      expect(decrypted).toBe(data);
      expect(encrypted).toContain(':');
      expect(encrypted.split(':')).toHaveLength(3); // IV:authTag:encrypted
    });
    
    test('should produce different encrypted output for same data', () => {
      const data = 'test-data';
      const encrypted1 = encryptWithMasterKey(data, masterKey);
      const encrypted2 = encryptWithMasterKey(data, masterKey);
      
      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to same value
      expect(decryptWithMasterKey(encrypted1, masterKey)).toBe(data);
      expect(decryptWithMasterKey(encrypted2, masterKey)).toBe(data);
    });
    
    test('should fail decryption with wrong master key', () => {
      const data = 'test-data';
      const wrongKey = 'b2c3d4e5f6789012345678901234567890123456789012345678901234567890';
      const encrypted = encryptWithMasterKey(data, masterKey);
      
      expect(() => {
        decryptWithMasterKey(encrypted, wrongKey);
      }).toThrow();
    });
    
    test('should handle empty string', () => {
      const data = '';
      const encrypted = encryptWithMasterKey(data, masterKey);
      const decrypted = decryptWithMasterKey(encrypted, masterKey);
      
      expect(decrypted).toBe('');
    });
    
    test('should handle long strings', () => {
      const data = 'a'.repeat(10000);
      const encrypted = encryptWithMasterKey(data, masterKey);
      const decrypted = decryptWithMasterKey(encrypted, masterKey);
      
      expect(decrypted).toBe(data);
    });
  });
  
  describe('generateKeyMaterial', () => {
    test('should generate 256-bit key for AES-256', () => {
      const key = generateKeyMaterial('AES-256-GCM');
      expect(key.length).toBe(64); // 32 bytes = 64 hex chars
    });
    
    test('should generate 128-bit key for AES-128', () => {
      const key = generateKeyMaterial('AES-128-GCM');
      expect(key.length).toBe(32); // 16 bytes = 32 hex chars
    });
    
    test('should default to 256-bit for unknown algorithms', () => {
      const key = generateKeyMaterial('UNKNOWN-ALGORITHM');
      expect(key.length).toBe(64);
    });
    
    test('should generate different keys each time', () => {
      const key1 = generateKeyMaterial('AES-256-GCM');
      const key2 = generateKeyMaterial('AES-256-GCM');
      
      expect(key1).not.toBe(key2);
    });
  });
  
  describe('deriveKey', () => {
    test('should derive consistent key from same inputs', () => {
      const masterKey = 'test-master-key';
      const salt = 'test-salt';
      const info = 'test-info';
      
      const key1 = deriveKey(masterKey, salt, info);
      const key2 = deriveKey(masterKey, salt, info);
      
      expect(key1).toBe(key2);
      expect(key1.length).toBe(64); // 256 bits = 64 hex chars
    });
    
    test('should produce different keys with different inputs', () => {
      const masterKey = 'test-master-key';
      const salt1 = 'salt1';
      const salt2 = 'salt2';
      
      const key1 = deriveKey(masterKey, salt1, 'info');
      const key2 = deriveKey(masterKey, salt2, 'info');
      
      expect(key1).not.toBe(key2);
    });
  });
  
  describe('hashKey', () => {
    test('should produce consistent hash', () => {
      const key = 'test-key-material';
      const hash1 = hashKey(key);
      const hash2 = hashKey(key);
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 = 64 hex chars
    });
    
    test('should produce different hashes for different keys', () => {
      const key1 = 'key1';
      const key2 = 'key2';
      
      const hash1 = hashKey(key1);
      const hash2 = hashKey(key2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});
