const { composeHostname, originService } = require('../../api/utils/hostnameParts');

describe('hostnameParts', () => {
  it('joins subdomain and domain', () => {
    expect(composeHostname('assistant', 'aerekos.com')).toBe('assistant.aerekos.com');
    expect(composeHostname('', 'aerekos.com')).toBe('aerekos.com');
    expect(composeHostname('.cloud.', '.aerekos.com.')).toBe('cloud.aerekos.com');
  });

  it('rejects a bare label as domain', () => {
    expect(() => composeHostname('x', 'localhost')).toThrow(/domain/);
  });

  it('builds origin service from port', () => {
    expect(originService('4200')).toBe('http://localhost:4200');
    expect(originService('22')).toBe('ssh://localhost:22');
    expect(originService('443', 'https')).toBe('https://localhost:443');
  });
});
