'use strict';

const fs = require('fs').promises;
const crypto = require('crypto');
const { Readable } = require('stream');

/**
 * Maximum number of bytes passed to a single cipher.update() call.
 *
 * OpenSSL's GCM rejects a single update() with input at or above 2 GiB
 * (surfaced as "data is too long"; Node reports it as
 * "File size (N) is greater than 2 GiB"), which made every object over
 * 2 GiB impossible to stream. GCM is a stream cipher (CTR core): its
 * internal counter state persists across successive update() calls, so the
 * ciphertext can be fed in chunks of any size with byte-identical output.
 * 8 MiB is 16-byte aligned and keeps per-call overhead negligible.
 */
const GCM_CHUNK_SIZE = 8 * 1024 * 1024;

/**
 * DecryptingStream
 *
 * Readable stream that decrypts a storage_manager object on the fly, in
 * bounded memory, from the canonical on-disk layout:
 *
 *   offset 0         IV (16 bytes)
 *   offset 16        ciphertext (fileSize - 32 bytes)
 *   offset fileSize-16  GCM auth tag (16 bytes)
 *
 * Memory usage is bounded by `chunkSize` regardless of object size, so a
 * 20 GiB movie streams with a constant footprint.
 *
 * Range support
 * -------------
 * GCM plaintext and ciphertext are the same length and byte-aligned, so an
 * HTTP Range read of plaintext bytes [start, end] is served by:
 *   1. advancing the GCM counter to the 16-byte block containing `start`
 *      by processing (and discarding) dummy blocks — the CTR core depends
 *      only on block count, so the skipped region never touches disk;
 *   2. reading only the ciphertext window that covers the range.
 * Range reads therefore read O(range) from disk, not O(file).
 *
 * Auth tag
 * --------
 * The GCM auth tag authenticates the ENTIRE ciphertext, so it can only be
 * verified when the whole ciphertext is processed. Full reads
 * (start=0, end=ctLen-1) verify the tag on completion; range reads skip
 * the check, the same trade-off object stores make for ranged reads of
 * server-side-encrypted objects.
 *
 * The stream is safe to destroy early (client disconnect / seek): the
 * underlying file handle is closed on destroy.
 */
class DecryptingStream extends Readable {
  /**
   * @param {object} opts
   * @param {string} opts.filePath   Absolute path of the encrypted object.
   * @param {Buffer} opts.iv         16-byte IV (first 16 bytes of the object).
   * @param {Buffer} opts.keyBuffer  32-byte AES-256 key.
   * @param {number} opts.ctLen      Ciphertext length in bytes (fileSize - 32).
   * @param {number} [opts.start=0]  First plaintext byte to emit (inclusive).
   * @param {number} [opts.end]      Last plaintext byte to emit (inclusive;
   *                                 defaults to ctLen - 1).
   * @param {boolean} [opts.verifyTag=true]
   *        Verify the GCM auth tag at the end (only meaningful for full reads).
   * @param {number} [opts.chunkSize=GCM_CHUNK_SIZE]
   *        Read/decrypt chunk size in bytes (16-byte aligned).
   */
  constructor({ filePath, iv, keyBuffer, ctLen, start = 0, end, verifyTag = true, chunkSize = GCM_CHUNK_SIZE }) {
    super();

    if (!filePath || typeof filePath !== 'string') {
      throw new Error('DecryptingStream: filePath is required');
    }
    if (!Buffer.isBuffer(iv) || iv.length !== 16) {
      throw new Error('DecryptingStream: iv must be a 16-byte Buffer');
    }
    if (!Buffer.isBuffer(keyBuffer) || keyBuffer.length !== 32) {
      throw new Error('DecryptingStream: keyBuffer must be a 32-byte Buffer');
    }
    if (!Number.isInteger(ctLen) || ctLen < 0) {
      throw new Error(`DecryptingStream: ctLen must be a non-negative integer, got ${ctLen}`);
    }
    if (!Number.isInteger(start) || start < 0 || start >= ctLen) {
      throw new Error(`DecryptingStream: start out of range: ${start} (ctLen=${ctLen})`);
    }
    const endIdx = (end === undefined) ? ctLen - 1 : end;
    if (!Number.isInteger(endIdx) || endIdx < start || endIdx >= ctLen) {
      throw new Error(`DecryptingStream: end out of range: ${endIdx} (start=${start}, ctLen=${ctLen})`);
    }
    if (!Number.isInteger(chunkSize) || chunkSize < 16 || chunkSize % 16 !== 0) {
      throw new Error(`DecryptingStream: chunkSize must be a 16-byte-aligned integer >= 16, got ${chunkSize}`);
    }

    this._filePath = filePath;
    this._iv = iv;
    this._keyBuffer = keyBuffer;
    this._ctLen = ctLen;
    this._start = start;
    this._end = endIdx;
    this._wantVerifyTag = !!verifyTag;
    this._chunkSize = chunkSize;

    // The GCM CTR counter advances in 16-byte blocks. To begin output at an
    // unaligned `start`, start feeding at the 16-byte block boundary before
    // it and trim the leading bytes off the first output chunk.
    this._feedStart = Math.floor(start / 16) * 16;
    this._pos = this._feedStart; // next ciphertext offset to feed the decipher

    this._fd = null;
    this._decipher = null;
    this._pending = false;
    this._finished = false;
  }

  /**
   * @private
   * Readable backpressure hook: pump one or more chunks while the
   * downstream consumer has capacity.
   */
  _read() {
    if (this._pending || this._finished) return;
    this._pending = true;
    this._pump().catch((err) => this.destroy(err));
  }

  /**
   * @private
   * Initialize file handle and cipher, advancing the GCM counter to the
   * aligned feed position for range reads (dummy blocks; no disk I/O for
   * the skipped region).
   */
  async _init() {
    this._fd = await fs.open(this._filePath, 'r');
    this._decipher = crypto.createDecipheriv('aes-256-gcm', this._keyBuffer, this._iv);
    if (this._feedStart > 0) {
      const dummy = Buffer.alloc(this._chunkSize, 0);
      for (let off = 0; off < this._feedStart; off += this._chunkSize) {
        this._decipher.update(dummy.subarray(0, Math.min(this._chunkSize, this._feedStart - off)));
      }
    }
  }

  /**
   * @private
   */
  async _pump() {
    try {
      if (!this._fd) await this._init();

      while (!this._finished) {
        if (this._pos >= this._end + 1) {
          if (this._wantVerifyTag) await this._verifyTag();
          this._finished = true;
          this.push(null);
          break;
        }

        const remaining = this._end + 1 - this._pos;
        if (remaining <= 0) break;

        const want = Math.min(this._chunkSize, remaining);
        const buf = Buffer.alloc(want);
        const { bytesRead } = await this._fd.read(buf, 0, want, 16 + this._pos);
        if (bytesRead === 0) {
          throw new Error(
            `Stored object truncated: expected ${want} ciphertext bytes at offset ${16 + this._pos} of ${this._filePath}`
          );
        }

        const out = this._decipher.update(buf.subarray(0, bytesRead));
        const outStart = this._pos;
        this._pos += bytesRead;

        // Map this ciphertext window onto the requested plaintext range.
        const from = outStart < this._start ? this._start - outStart : 0;
        const to = Math.min(this._pos, this._end + 1) - outStart;
        if (from < to && !this.push(out.subarray(from, to))) {
          break; // backpressure: _read() resumes once the consumer drains
        }
      }
    } finally {
      this._pending = false;
    }
  }

  /**
   * @private
   * Verify the GCM auth tag (last 16 bytes of the object). Only valid once
   * the entire ciphertext has been processed.
   */
  async _verifyTag() {
    const tag = Buffer.alloc(16);
    const { bytesRead } = await this._fd.read(tag, 0, 16, 16 + this._ctLen);
    if (bytesRead < 16) {
      throw new Error(`Stored object truncated: auth tag missing in ${this._filePath}`);
    }
    this._decipher.setAuthTag(tag);
    try {
      this._decipher.final();
    } catch (err) {
      throw new Error(`Decryption failed (auth tag mismatch): ${err.message}`);
    }
  }

  /**
   * @private
   * Stream teardown: release the file handle (also on early destroy from
   * client disconnect / seek).
   */
  _destroy(err, callback) {
    if (this._fd) {
      this._fd.close()
        .catch(() => {})
        .then(() => callback(err), () => callback(err));
    } else {
      callback(err);
    }
  }
}

module.exports = DecryptingStream;
module.exports.GCM_CHUNK_SIZE = GCM_CHUNK_SIZE;
