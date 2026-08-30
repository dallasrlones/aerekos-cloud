'use strict';
/** Run spine + Tier 6 only (faster M1 app-access verification). */
process.env.E2E_TIER6_ONLY = '1';
require('./run.js');
