const { getThemePure, palettes } = require('../../app/styles/themePalettes');

describe('theme light/dark parity', () => {
  test('color keys match', () => {
    expect(Object.keys(palettes.dark.colors).sort())
      .toEqual(Object.keys(palettes.light.colors).sort());
  });

  test('animus keys match', () => {
    expect(Object.keys(palettes.dark.animus).sort())
      .toEqual(Object.keys(palettes.light.animus).sort());
  });

  test('status keys match', () => {
    expect(Object.keys(palettes.dark.status).sort())
      .toEqual(Object.keys(palettes.light.status).sort());
  });

  test('dark glass differs from light glass', () => {
    expect(getThemePure('dark').animus.glass).not.toBe(getThemePure('light').animus.glass);
    expect(getThemePure('dark').colors.background).not.toBe(getThemePure('light').colors.background);
  });

  test('getThemePure returns status + isDark', () => {
    const d = getThemePure('dark');
    expect(d.isDark).toBe(true);
    expect(d.status.running).toBeTruthy();
    expect(d.mode).toBe('dark');
  });
});
