const { PLATFORM_TOOLS } = require('../../api/schemas/platformTools');

describe('mcp_manager platform-tools catalog', () => {
  test('exports non-empty PLATFORM_TOOLS with required fields', () => {
    expect(Array.isArray(PLATFORM_TOOLS)).toBe(true);
    expect(PLATFORM_TOOLS.length).toBeGreaterThan(0);
    for (const t of PLATFORM_TOOLS) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.input_schema).toBeTruthy();
    }
  });

  test('includes core platform tool names', () => {
    const names = PLATFORM_TOOLS.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining([
      'backup.run', 'iac.hookup', 'systems.check', 'graphql.execute', 'search.query',
    ]));
  });
});
