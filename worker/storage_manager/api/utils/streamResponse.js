'use strict';

const logger = require('./logger');

/**
 * Pipe a download stream to an Express response with production-grade
 * edge handling:
 *
 *  - If the client disconnects early (seek, tab close, retry), the source
 *    stream is destroyed so the object is not kept being read/decrypted
 *    after the response has ended.
 *  - Mid-stream failures (e.g. GCM auth tag mismatch, truncated object)
 *    return a 500 if headers have not been sent yet, or abort the
 *    in-flight response otherwise — instead of leaving the request
 *    hanging.
 *
 * Call this AFTER setting the status and all response headers.
 *
 * @param {import('stream').Readable} stream
 * @param {import('express').Response} res
 */
function pipeStreamToResponse(stream, res) {
  const stopSource = () => stream.destroy();
  res.on('close', stopSource);
  stream.on('end', () => res.off('close', stopSource));
  stream.on('error', (err) => {
    logger.error(`[stream-response] stream error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        error: { message: `Download failed: ${err.message}`, status: 500 }
      });
    } else {
      res.destroy(err);
    }
  });
  stream.pipe(res);
}

module.exports = { pipeStreamToResponse };
