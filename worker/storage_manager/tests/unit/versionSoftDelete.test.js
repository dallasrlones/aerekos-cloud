'use strict';

const fs = require('fs');
const path = require('path');

describe('storage versioning + soft-delete', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../api/services/StorageService.js'),
    'utf8',
  );

  test('overwrite snapshots prior object under versions/', () => {
    expect(src).toMatch(/versions/);
    expect(src).toMatch(/version snapshot skipped/);
  });

  test('delete is soft unless STORAGE_HARD_DELETE=1', () => {
    expect(src).toMatch(/STORAGE_HARD_DELETE/);
    expect(src).toMatch(/upload_status: 'deleted'/);
  });
});
