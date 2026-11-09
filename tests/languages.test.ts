import { describe, expect, it } from 'vitest';
import { errorInfo } from '../src/i18n/error.js';
import { translator } from '../src/i18n/index.js';
import {
  exactTarget,
  languageName,
  resolveSource,
  resolveTarget,
  suggestSource,
  suggestTarget,
  supportedSource,
  supportedTarget,
  supportsPoliteness,
  targetCodeOf,
  targetOptions,
} from '../src/translation/language-codes.js';

describe('language codes (no guessing beyond the defaults)', () => {
  it('uses the mapping, else an exact Supertext code, else the default, else nothing', () => {
    expect(resolveTarget('de', { de: 'de-CH' })).toBe('de-CH');
    expect(resolveTarget('de_ch', {})).toBe('de-CH');
    expect(resolveTarget('es', {})).toBe('es');
    expect(targetCodeOf('de', {})).toBe('de-DE'); // the SDK default
    expect(targetCodeOf('zh-CN', {})).toBe('zh-Hans');
    expect(targetCodeOf('es-ES', {})).toBe('es');
    expect(targetCodeOf('en-IE', {})).toBeNull(); // no default: needs a mapping
    expect(suggestTarget('de')).toBe('de-DE');
    expect(suggestTarget('fr-CH')).toBe('fr-CH');
    expect(suggestTarget('gsw')).toBeNull();
    expect(suggestSource('en-US')).toBe('en');
    expect(targetOptions()).toContain('gsw-u-sd-chzh');
    expect(exactTarget('fr-ch')).toBe('fr-CH');
    let error: unknown;
    try {
      resolveTarget('en-IE', {});
    } catch (caught) {
      error = caught;
    }
    const info = errorInfo(error);
    expect(info).toMatchObject({ code: 'unsupported_language', params: { language: 'en-IE' } });
    expect(translator('de').error(info)).toContain('„en-IE“ hat noch keine Supertext-Sprache');
  });

  it('sends the source bare; one mapping serves both directions', () => {
    expect(resolveSource('en-US', {})).toBe('en');
    expect(resolveSource('de', { de: 'de-CH' })).toBe('de');
    expect(() => resolveSource('xx', {})).toThrow();
  });

  it('accepts only codes Supertext offers in the settings', () => {
    expect(supportedTarget('de-de')).toBe('de-DE');
    expect(supportedTarget('de')).toBeNull();
    expect(supportedTarget('french')).toBeNull();
    expect(supportedSource('EN')).toBe('en');
    expect(supportedSource('en-US')).toBeNull();
  });

  it('knows where formal/informal address exists', () => {
    expect(supportsPoliteness('de-CH')).toBe(true);
    expect(supportsPoliteness('en-US')).toBe(false);
    expect(supportsPoliteness('xx')).toBe(false);
  });

  it('names languages in the interface language', () => {
    expect(languageName('de-CH', 'de')).toBe('Deutsch (Schweiz)');
    expect(languageName('gsw-u-sd-chzh', 'en')).toMatch(/\(Zürich\)$/);
  });
});
