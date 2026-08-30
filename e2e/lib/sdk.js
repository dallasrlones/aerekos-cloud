'use strict';

const path = require('path');
const { AerekosClient } = require(path.join(__dirname, '../../aerekos-sdk'));
const { conductorBase } = require('./icarusLive');

function sdkClient(token) {
  const client = new AerekosClient({ baseUrl: conductorBase() });
  if (token) client.setToken(token);
  return client;
}

module.exports = { sdkClient };
