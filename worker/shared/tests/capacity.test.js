'use strict';

const { canFit, estimateModelGb } = require('../capacity');

describe('capacity', () => {
  test('refuses when request plus reserve exceeds free', () => {
    const fit = canFit({ totalGb: 64, usedGb: 50, requestGb: 12, reserveGb: 8 });
    expect(fit.ok).toBe(false);
    expect(fit.code).toBe('INSUFFICIENT_MEMORY');
  });
  test('allows when headroom remains', () => {
    const fit = canFit({ totalGb: 64, usedGb: 20, requestGb: 18, reserveGb: 8 });
    expect(fit.ok).toBe(true);
  });
  test('AWQ estimate is under fp16', () => {
    expect(estimateModelGb({ paramsB: 35, quant: 'awq' })).toBeLessThan(estimateModelGb({ paramsB: 35, quant: 'fp16' }));
  });
});
