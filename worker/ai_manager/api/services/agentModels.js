'use strict';

/** Lazy models so unit tests without sqlite bindings stay in-memory. */
function agentModels() {
  try {
    return require('../models');
  } catch {
    return null;
  }
}

module.exports = { agentModels };
