'use strict';

const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const DecryptingStream = require('../../../api/services/DecryptingStream');
const EncryptionService = require('../../../api/services/EncryptionService');

// Use the shared mock key so EncryptionService + DecryptingStream agree.
process.env.MOCK_KEY_MANAGER = 'true';
const MOCK_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const KEY_BUF = Buffer['from'](MOCK_KEY, 'hex');

function readAll(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Build a deterministic plaintext of exactly `len` bytes (repeat a 32-byte
// pattern so any slice can be verified independently).
function makePlain(len) {
  const block = crypto.randomBytes(32);
  const buf = Buffer.alloc(len);
  for (let i = 0; i < len; i += 32) {
    const n = Math.min(32, len - i);
    block.copy(buf, i, 0, n);
  }
  return buf;
}

async function writeObject(plain) {
  const svc = new EncryptionService('http://localhost:1', 'tok');
  const enc = await svc.encryptBuffer(plain, 'k', 'p');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dstream-'));
  const file = path.join(dir, 'obj.bin');
  await fs.writeFile(file, enc);
  return { file, enc, dir };
}

describe('DecryptingStream (unit)', () => {
  it('decrypts a full object to the exact plaintext', async () => {
    const plain = makePlain(1024);
    const { file, enc } = await writeObject(plain);
    const out = await readAll(
      new DecryptingStream({
        filePath: file,
        iv: enc.subarray(0, 16),
        keyBuffer: KEY_BUF,
        ctLen: enc.length - 32,
      })
    );
    expect(out.equals(plain)).toBe(true);
  });

  it('serves arbitrary single-byte ranges (unaligned offsets)', async () => {
    const plain = makePlain(4096);
    const { file, enc } = await writeObject(plain);
    const ctLen = enc.length - 32;
    for (const offset of [0, 1, 15, 16, 17, 1024, 4095]) {
      const out = await readAll(
        new DecryptingStream({
          filePath: file,
          iv: enc.subarray(0, 16),
          keyBuffer: KEY_BUF,
          ctLen,
          start: offset,
          end: offset,
          verifyTag: false,
        })
      );
      expect(out.equals(plain.subarray(offset, offset + 1))).toBe(true);
    }
  });

  it('serves a multi-chunk range with unaligned boundaries', async () => {
    const plain = makePlain(20000);
    const { file, enc } = await writeObject(plain);
    const ctLen = enc.length - 32;
    const start = 1234;
    const end = 18000;
    const out = await readAll(
      new DecryptingStream({
        filePath: file,
        iv: enc.subarray(0, 16),
        keyBuffer: KEY_BUF,
        ctLen,
        start,
        end,
        verifyTag: false,
        chunkSize: 4096,
      })
    );
    expect(out.length).toBe(end - start + 1);
    expect(out.equals(plain.subarray(start, end + 1))).toBe(true);
  });

  it('serves a tail range (bytes=-N equivalent)', async () => {
    const plain = makePlain(5000);
    const { file, enc } = await writeObject(plain);
    const ctLen = enc.length - 32;
    const n = 777;
    const out = await readAll(
      new DecryptingStream({
        filePath: file,
        iv: enc.subarray(0, 16),
        keyBuffer: KEY_BUF,
        ctLen,
        start: ctLen - n,
        end: ctLen - 1,
        verifyTag: false,
      })
    );
    expect(out.equals(plain.subarray(ctLen - n, ctLen))).toBe(true);
  });

  it('full-range read with verifyTag succeeds on a good object', async () => {
    const plain = makePlain(9000);
    const { file, enc } = await writeObject(plain);
    const ctLen = enc.length - 32;
    const out = await readAll(
      new DecryptingStream({
        filePath: file,
        iv: enc.subarray(0, 16),
        keyBuffer: KEY_BUF,
        ctLen,
        start: 0,
        end: ctLen - 1,
        verifyTag: true,
      })
    );
    expect(out.equals(plain)).toBe(true);
  });

  it('full-range read rejects on a corrupted ciphertext (auth tag)', async () => {
    const plain = makePlain(9000);
    const { file, enc } = await writeObject(plain);
    const ctLen = enc.length - 32;
    // Flip a byte in the middle of the ciphertext.
    enc[ctLen >> 1] ^= 0xff;
    await fs.writeFile(file, enc);
    await expect(
      readAll(
        new DecryptingStream({
          filePath: file,
          iv: enc.subarray(0, 16),
          keyBuffer: KEY_BUF,
          ctLen,
          start: 0,
          end: ctLen - 1,
          verifyTag: true,
        })
      )
    ).rejects.toThrow(/auth tag/i);
  });

  it('full-range read rejects on a truncated (missing tag) object', async () => {
    const plain = makePlain(9000);
    const { file, enc } = await writeObject(plain);
    const ctLen = enc.length - 32;
    // Drop the final 16-byte auth tag.
    await fs.writeFile(file, enc.subarray(0, enc.length - 16));
    await expect(
      readAll(
        new DecryptingStream({
          filePath: file,
          iv: enc.subarray(0, 16),
          keyBuffer: KEY_BUF,
          ctLen,
          start: 0,
          end: ctLen - 1,
          verifyTag: true,
        })
      )
    ).rejects.toThrow(/truncated/i);
  });

  it('range read skips the skipped region without touching it', async () => {
    const plain = makePlain(9000);
    const { file, enc } = await writeObject(plain);
    const ctLen = enc.length - 32;
    // Corrupt a byte far after the range we request; a range read that does
    // not verify the tag must still return the requested slice cleanly.
    enc[ctLen - 10] ^= 0xff;
    await fs.writeFile(file, enc);
    const out = await readAll(
      new DecryptingStream({
        filePath: file,
        iv: enc.subarray(0, 16),
        keyBuffer: KEY_BUF,
        ctLen,
        start: 100,
        end: 199,
        verifyTag: false,
      })
    );
    expect(out.equals(plain.subarray(100, 200))).toBe(true);
  });

  it('rejects malformed constructor arguments', () => {
    expect(() => new DecryptingStream({
      filePath: 'x', iv: Buffer.alloc(15), keyBuffer: KEY_BUF, ctLen: 10,
    })).toThrow(/iv/);
    expect(() => new DecryptingStream({
      filePath: 'x', iv: Buffer.alloc(16), keyBuffer: Buffer.alloc(31), ctLen: 10,
    })).toThrow(/keyBuffer/);
    expect(() => new DecryptingStream({
      filePath: 'x', iv: Buffer.alloc(16), keyBuffer: KEY_BUF, ctLen: 0,
    })).toThrow(/ctLen/);
    expect(() => new DecryptingStream({
      filePath: 'x', iv: Buffer.alloc(16), keyBuffer: KEY_BUF, ctLen: 10, start: 10,
    })).toThrow(/start/);
  });
});

describe('DecryptingStream > 2 GiB regression (unit)', () => {
  // OpenSSL's GCM rejects a single update() call of >= 2 GiB ("data is too
  // long"; Node surfaces it as "File size (N) is greater than 2 GiB") - this
  // was the production failure for every stored object over 2 GiB (movies).
  //
  // Plaintext is 2 GiB + 16 bytes: the ciphertext is 2 GiB + 16, so a
  // single-shot update would sit exactly on the failing boundary, and one
  // of the ranges below crosses the 2^31 byte mark.
  const N = 2 * 1024 * 1024 * 1024 + 16;
  const block = crypto.createHash('sha256').update('aerekos-2gib-block').digest().subarray(0, 16);

  // Arbitrary-offset pattern slice (used for the small range tests).
  // The plaintext is `block` repeated; `block.copy` runs in 16-byte segments,
  // so advance by the amount actually written (take) — a fixed 16-byte step
  // would leave zero gaps for unaligned offsets.
  function patternAt(offset, len) {
    const out = Buffer.alloc(len);
    let i = 0;
    while (i < len) {
      const src = (offset + i) % 16;
      const take = Math.min(16 - src, len - i);
      block.copy(out, i, src, src + take);
      i += take;
    }
    return out;
  }

  // Efficiently precompute a 16-byte-aligned pattern chunk via doubling
  // (19 copy steps for 8 MiB instead of 524288 tiny copies).
  function alignedChunk(size) {
    let cur = block;
    while (cur.length < size) {
      const next = Buffer.alloc(Math.min(cur.length * 2, size));
      for (let off = 0; off < next.length; off += cur.length) cur.copy(next, off);
      cur = next;
    }
    return cur;
  }

  const FULL = 8 * 1024 * 1024;
  const fullChunk = alignedChunk(FULL);
  const fullCount = Math.floor(N / FULL); // 256
  const tailLen = N - fullCount * FULL; // 16
  const parts = [];
  for (let i = 0; i < fullCount; i++) parts.push(fullChunk);
  if (tailLen > 0) parts.push(alignedChunk(tailLen));

  const EXPECTED_MD5 = (() => {
    const h = crypto.createHash('md5');
    for (const p of parts) h.update(p);
    return h.digest('hex');
  })();

  function patternStream() {
    return Readable.from(parts);
  }

  let file = null;
  let encLen = 0;

  beforeAll(async () => {
    jest.setTimeout(600000);
    // Write the object through the PRODUCTION upload path (encryptStream,
    // chunked), keeping memory bounded at ~16 MiB.
    const svc = new EncryptionService('http://localhost:1', 'tok');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dstream-2gib-'));
    file = path.join(dir, 'big.bin');
    const input = patternStream();
    const enc = await svc.encryptStream(input, 'k', 'p');
    // Production contract: the caller pipes the input into the returned
    // Transform (see StorageService.uploadFile's pipelineAsync).
    await pipeline(input, enc, fsSync.createWriteStream(file));
    encLen = (await fs.stat(file)).size;
  }, 600000);

  it('encrypts 2 GiB+16 and the file is IV + ciphertext + tag', () => {
    expect(encLen).toBe(16 + N + 16);
  });

  it('streams the full object back, byte-for-byte, verifying the auth tag', async () => {
    const head = Buffer.alloc(16);
    const fd = await fs.open(file, 'r');
    await fd.read(head, 0, 16, 0);
    await fd.close();

    const stream = new DecryptingStream({
      filePath: file,
      iv: head,
      keyBuffer: KEY_BUF,
      ctLen: encLen - 32,
      start: 0,
      end: N - 1,
      verifyTag: true,
    });

    const md5 = crypto.createHash('md5');
    let got = 0;
    let idx = 0;
    for await (const chunk of stream) {
      expect(chunk.length).toBe(parts[idx].length);
      expect(chunk.equals(parts[idx])).toBe(true);
      md5.update(chunk);
      got += chunk.length;
      idx += 1;
    }
    expect(got).toBe(N);
    expect(idx).toBe(parts.length);
    expect(md5.digest('hex')).toBe(EXPECTED_MD5);
  }, 600000);

  it('serves a range crossing the 2 GiB boundary', async () => {
    const head = Buffer.alloc(16);
    const fd = await fs.open(file, 'r');
    await fd.read(head, 0, 16, 0);
    await fd.close();

    const start = 2 * 1024 * 1024 * 1024 - 16;
    const end = 2 * 1024 * 1024 * 1024 + 15; // == N - 1 (last byte)
    const out = await readAll(
      new DecryptingStream({
        filePath: file,
        iv: head,
        keyBuffer: KEY_BUF,
        ctLen: encLen - 32,
        start,
        end,
        verifyTag: false,
      })
    );
    expect(out.equals(patternAt(start, end - start + 1))).toBe(true);
  });

  it('serves a mid-file and a head range', async () => {
    const head = Buffer.alloc(16);
    const fd = await fs.open(file, 'r');
    await fd.read(head, 0, 16, 0);
    await fd.close();

    const midStart = 123456789;
    const mid = await readAll(
      new DecryptingStream({
        filePath: file,
        iv: head,
        keyBuffer: KEY_BUF,
        ctLen: encLen - 32,
        start: midStart,
        end: midStart + 999,
        verifyTag: false,
      })
    );
    expect(mid.equals(patternAt(midStart, 1000))).toBe(true);

    const headRange = await readAll(
      new DecryptingStream({
        filePath: file,
        iv: head,
        keyBuffer: KEY_BUF,
        ctLen: encLen - 32,
        start: 0,
        end: 15,
        verifyTag: false,
      })
    );
    expect(headRange.equals(block)).toBe(true);
  });
});
