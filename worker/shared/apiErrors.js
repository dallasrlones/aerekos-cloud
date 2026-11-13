'use strict';

/**
 * Uniform API error envelope (enterprise E4):
 *   { error: { code, message, request_id, resource? } }
 *
 * Dependency-free — safe under worker/shared in Docker.
 */

const DEFAULT_CODES = {
  400: 'ValidationError',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'NotFound',
  409: 'Conflict',
  422: 'UnprocessableEntity',
  429: 'TooManyRequests',
  500: 'InternalError',
  503: 'ServiceUnavailable',
};

function httpStatusToCode(status) {
  return DEFAULT_CODES[status] || 'InternalError';
}

/**
 * @param {{ code?: string, message: string, request_id?: string|null, resource?: string }} fields
 */
function formatErrorBody({ code, message, request_id = null, resource }) {
  const body = {
    error: {
      code: code || 'InternalError',
      message: message || 'Internal server error',
      request_id: request_id || undefined,
    },
  };
  if (resource) body.error.resource = resource;
  if (!body.error.request_id) delete body.error.request_id;
  return body;
}

function appError(status, message, { code, resource } = {}) {
  const e = new Error(message);
  e.status = status;
  e.code = code || httpStatusToCode(status);
  if (resource) e.resource = resource;
  return e;
}

/**
 * @param {import('express').Response} res
 */
function sendError(res, status, { code, message, request_id, resource }) {
  res.status(status).json(
    formatErrorBody({
      code: code || httpStatusToCode(status),
      message,
      request_id,
      resource,
    })
  );
}

/**
 * Express error middleware using the uniform envelope (opt-in; does not replace managerBootstrap.errorHandler).
 */
function createUniformErrorHandler() {
  return function uniformErrorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);
    const status = err.status || 500;
    const request_id = req.id || req.headers?.['x-request-id'] || null;
    res.status(status).json(
      formatErrorBody({
        code: err.code || httpStatusToCode(status),
        message: err.message || 'Internal server error',
        request_id,
        resource: err.resource,
      })
    );
  };
}

module.exports = {
  httpStatusToCode,
  formatErrorBody,
  appError,
  sendError,
  createUniformErrorHandler,
};
