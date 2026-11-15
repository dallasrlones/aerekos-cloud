'use strict';

const {
  isProtectedSystemBucket,
  assertSystemBucketDeletable,
  parseBucketMetadata,
} = require('../../../api/utils/systemResourceGuard');

describe('systemResourceGuard', () => {
  test('parseBucketMetadata handles object and JSON string', () => {
    expect(parseBucketMetadata({ metadata: { protected: true } })).toEqual({ protected: true });
    expect(parseBucketMetadata({ metadata: '{"immutable":true}' })).toEqual({ immutable: true });
    expect(parseBucketMetadata({ metadata: 'not-json' })).toEqual({});
  });

  test('isProtectedSystemBucket honors metadata flags', () => {
    expect(isProtectedSystemBucket({ name: 'a', metadata: { protected: true } })).toBe(true);
    expect(isProtectedSystemBucket({ name: 'a', metadata: { undeletable: 'yes' } })).toBe(true);
    expect(isProtectedSystemBucket({ name: 'a', metadata: {} })).toBe(false);
  });

  test('isProtectedSystemBucket honors SYSTEM_PROTECTED_BUCKET_NAMES', () => {
    const env = { SYSTEM_PROTECTED_BUCKET_NAMES: 'tv-media, tv-posters' };
    expect(isProtectedSystemBucket({ name: 'TV-Media', metadata: {} }, env)).toBe(true);
    expect(isProtectedSystemBucket({ name: 'scratch', metadata: {} }, env)).toBe(false);
  });

  test('assertSystemBucketDeletable throws SYSTEM_BUCKET_IMMUTABLE', () => {
    expect(() =>
      assertSystemBucketDeletable({ name: 'tv-media', metadata: { protected: true } })
    ).toThrow(
      expect.objectContaining({ code: 'SYSTEM_BUCKET_IMMUTABLE', status: 403 })
    );
  });
});
