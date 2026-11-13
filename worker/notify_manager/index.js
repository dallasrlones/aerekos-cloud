'use strict';

/**
 * Thin notify_manager entry — routes through worker/shared notifyFacade + notifyProviders.
 * Defaults to MockProvider (no paid/third-party sends) unless NOTIFY_USE_MOCK=0.
 */

if (process.env.NOTIFY_USE_MOCK == null || process.env.NOTIFY_USE_MOCK === '') {
  process.env.NOTIFY_USE_MOCK = '1';
}

const { notify, notifyFanout } = require('../shared/notifyFacade');
const {
  MockProvider,
  createChannelProvider,
  legacyManagerPayload,
} = require('../shared/notifyProviders');

module.exports = {
  notify,
  notifyFanout,
  MockProvider,
  createChannelProvider,
  legacyManagerPayload,
};
