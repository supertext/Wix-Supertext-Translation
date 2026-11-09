// Wix locale IDs → Supertext language codes, with the Supertext SDK's `Languages`.
//
// No guessing beyond the obvious: a Wix locale is sent as the Supertext code the site
// chose for it in its combo box under Settings → Languages (one mapping for both
// directions), else as the supported Supertext code it equals (case and _/- ignored:
// "de-CH", "es"), else as the SDK's default (de → de-DE, en → en-US, fr → fr-FR,
// it → it-IT, pt → pt-PT, zh → zh-Hans, sr → sr-Latn, zh-TW → zh-Hant, es-ES → es, …),
// else it has no Supertext language and nothing is sent (`unsupported_language`:
// en-IE, de-LI, gsw, sr-RS, … have to be mapped).
//
// Pure functions without the SDK client, so the views can use them too.

import { Languages, SOURCE_LANGUAGES, TARGET_LANGUAGES } from '../supertext/index.js';

export type Mapping = Record<string, string>;

export { SOURCE_LANGUAGES, TARGET_LANGUAGES };

/** The target code to send for a Wix locale. Throws the SDK's `unsupported_language`. */
export const resolveTarget = (wixLocale: string, mapping: Mapping): string => Languages.target(wixLocale, mapping);

/** The source code to send for the site's main locale ("en-US" → "en"). Throws `unsupported_language`. */
export const resolveSource = (wixLocale: string, mapping: Mapping): string => Languages.source(wixLocale, mapping);

/** The target code for a Wix locale, or null if it has none (unmapped, no exact match, no default). */
export function targetCodeOf(wixLocale: string, mapping: Mapping): string | null {
  try {
    return resolveTarget(wixLocale, mapping);
  } catch {
    return null;
  }
}

/** The source code for the main locale, or null. */
export function sourceCodeOf(wixLocale: string, mapping: Mapping): string | null {
  try {
    return resolveSource(wixLocale, mapping);
  } catch {
    return null;
  }
}

/** The supported target a Wix locale equals without a mapping ("de-ch" → "de-CH", "de" → null). */
export const exactTarget = (wixLocale: string): string | null => Languages.matchTarget(wixLocale);

/** What the combo box preselects for an unmapped locale: the exact match, else the default, else null. */
export const suggestTarget = (wixLocale: string): string | null => Languages.suggestTarget(wixLocale);

/** What the main language's combo box preselects: the source code it equals ("en-US" → "en"), else null. */
export const suggestSource = (wixLocale: string): string | null => sourceCodeOf(wixLocale, {});

/** Supertext's target codes for the combo box (the SDK's `targetOptions()`). */
export const targetOptions = (): string[] => Languages.targetOptions().map((language) => language.code);

/** A value from the settings form as a supported target code, or null. */
export const supportedTarget = (code: string): string | null => Languages.matchTarget(code);

/** A value from the settings form as a supported source code (bare, as listed), or null. */
export function supportedSource(code: string): string | null {
  const wanted = code.trim().replace(/_/g, '-').toLowerCase();
  return SOURCE_LANGUAGES.find((language) => language.code.toLowerCase() === wanted)?.code ?? null;
}

/** Whether formal/informal address can be sent for this target (false or unknown: don't send it). */
export const supportsPoliteness = (target: string): boolean => Languages.supportsPoliteness(target) === true;

const GSW_REGIONS: Record<string, string> = { chzh: 'Zürich', chbe: 'Bern' };
const displayNames = new Map<string, Intl.DisplayNames | null>();

function namesFor(uiLocale: string): Intl.DisplayNames | null {
  if (!displayNames.has(uiLocale)) {
    try {
      displayNames.set(uiLocale, new Intl.DisplayNames([uiLocale], { type: 'language', languageDisplay: 'standard' }));
    } catch {
      displayNames.set(uiLocale, null);
    }
  }
  return displayNames.get(uiLocale)!;
}

/** A Supertext code's name in the interface language ("de-CH" → "Deutsch (Schweiz)"). */
export function languageName(code: string, uiLocale: string): string {
  const gsw = /^gsw-u-sd-(\w+)$/.exec(code);
  const names = namesFor(uiLocale);
  try {
    if (names && gsw) return `${names.of('gsw')} (${GSW_REGIONS[gsw[1]] ?? gsw[1]})`;
    if (names) return names.of(code) ?? code;
  } catch {
    // fall through
  }
  return TARGET_LANGUAGES.find((language) => language.code === code)?.name ?? code;
}
