'use strict';

/**
 * Re-export worker/shared metrics so conductor and managers share one implementation.
 */
const { requireShared } = require('./loadWorkerShared');
module.exports = requireShared('simplePrometheusMetrics');
