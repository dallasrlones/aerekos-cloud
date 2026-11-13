'use strict';

/**
 * Optional manager kernel (OSS wow-bar) — compose shared primitives without changing legacy bootstrap.
 *
 * @example
 * const express = require('express');
 * const {
 *   requestIdMiddleware,
 *   createUniformErrorHandler,
 *   registerManagerProbes,
 *   parseListQuery,
 *   paginateArray,
 *   Provider,
 * } = require('./managerKernel');
 *
 * const app = express();
 * app.use(express.json());
 * app.use(requestIdMiddleware);
 * registerManagerProbes(app, { serviceName: 'example_manager', metrics: true });
 *
 * app.get('/api/v1/things', (req, res) => {
 *   const { limit, cursor } = parseListQuery(req.query);
 *   const all = []; // load sorted rows
 *   res.json(paginateArray(all, { limit, cursor }));
 * });
 *
 * app.use(createUniformErrorHandler());
 */

const cursorPagination = require('./cursorPagination');
const apiErrors = require('./apiErrors');
const { requestIdMiddleware } = require('./requestId');
const { otelTraceMiddleware } = require('./otelTrace');
const { registerManagerProbes } = require('./managerProbes');
const provider = require('./provider');
const idempotencyKey = require('./idempotencyKey');
const softDelete = require('./softDelete');

module.exports = {
  ...cursorPagination,
  ...apiErrors,
  requestIdMiddleware,
  otelTraceMiddleware,
  registerManagerProbes,
  ...provider,
  ...idempotencyKey,
  ...softDelete,
};
