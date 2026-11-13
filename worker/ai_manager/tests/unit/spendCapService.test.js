'use strict';

const { SpendCapService } = require('../../api/services/SpendCapService');
const { CharterService } = require('../../api/services/CharterService');
const { EnergyRouter } = require('../../api/services/EnergyRouter');

describe('SpendCapService', () => {
  test('denies when daily USD cap exceeded', () => {
    const charter = new CharterService();
    const energy = new EnergyRouter();
    const svc = new SpendCapService({ charter, energy });
    const pid = 'cap-usd';
    charter.set(pid, { spend_cap_usd_day: 2 });
    energy.record(pid, 2.5);
    const hit = svc.check(pid);
    expect(hit.allow).toBe(false);
    expect(hit.reason).toBe('spend_cap');
  });

  test('denies when token cap would be exceeded', () => {
    const charter = new CharterService();
    const energy = new EnergyRouter();
    const svc = new SpendCapService({ charter, energy });
    const pid = 'cap-tok';
    charter.set(pid, { token_cap_day: 1000 });
    svc.recordTokens(pid, 980);
    const hit = svc.check(pid, { estimatedTokens: 50 });
    expect(hit.allow).toBe(false);
    expect(hit.reason).toBe('token_cap');
  });

  test('checkTool uses higher estimate for mutating tools', () => {
    const charter = new CharterService();
    const energy = new EnergyRouter();
    const svc = new SpendCapService({ charter, energy });
    const pid = 'cap-tool';
    charter.set(pid, { token_cap_day: 200, spend_cap_usd_day: 999 });
    svc.recordTokens(pid, 120);
    expect(svc.checkTool(pid, 'file_read', { estimatedTokens: 500 }).allow).toBe(true);
    expect(svc.checkTool(pid, 'file_write', { estimatedTokens: 500 }).allow).toBe(false);
  });
});
