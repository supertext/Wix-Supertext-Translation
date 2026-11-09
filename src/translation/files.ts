// Translation files: "Export for translation" and "Import translation" (XLIFF 1.2 or HTML).
//
// The Supertext SDK's TranslationFiles (src/vendor/supertext-sdk/translation-file.ts, via src/supertext)
// does the file formats; this glue collects the segments exactly like the API
// translation (collectSegments: field keys, `<field>#<n>` for rich-text blocks), finds
// the item again from the job's reference and writes the imported texts back like API
// results (buildFields + saveFields, with the site's *publish* setting).
import { errorInfo, LocalizedError, type ErrorInfo } from '../i18n/error.js';
import {
  TranslationFileError,
  TranslationFiles,
  type FileFormat,
  type FileJob,
  type ImportStatus,
} from '../supertext/index.js';
import type { Content, Schema, WixClient } from '../wix/client.js';
import { entityTitle } from './fields.js';
import { sourceCodeOf, targetCodeOf, type Mapping } from './language-codes.js';
import { localeName, siteLanguages } from './site.js';
import { buildFields, collectSegments, saveFields } from './translate.js';

/** The `plugin` written into every file: the repository name. */
export const PLUGIN = 'Wix-Supertext-Translation';

/** Uploads larger than this are refused before they are read. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type Wix = Pick<WixClient, 'locales' | 'schemas' | 'allContents' | 'saveContent'>;

/**
 * The job's reference: translation schema, entity and Wix target locale, e.g.
 * `<schema id>:<entity id>:fr` (Wix ids, never titles).
 */
export const fileReference = (schemaId: string, entityId: string, locale: string): string => `${schemaId}:${entityId}:${locale}`;

/** Schema, entity and locale of a reference, or null if it isn't one of ours. */
export function parseReference(reference: string): { schemaId: string; entityId: string; locale: string } | null {
  const match = /^([^:\s]+):([^\s]+):([A-Za-z0-9_-]+)$/.exec(reference.trim());
  return match ? { schemaId: match[1], entityId: match[2], locale: match[3] } : null;
}

/**
 * Throws `file_too_large` for an upload over MAX_UPLOAD_BYTES: first by the request's
 * Content-Length (before the body is read; 64 KB for the rest of the form), then by the file.
 */
export function refuseLargeUpload(contentLength: string | null | undefined, file?: { size: number }): void {
  const tooLarge = Number(contentLength ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024 || (file !== undefined && file.size > MAX_UPLOAD_BYTES);
  if (tooLarge) throw new LocalizedError('The file is too large (at most 10 MB).', 'file_too_large');
}

/** A Supertext code for the file: the mapping (or exact match, or default), else the Wix code with `-`. */
const targetCode = (locale: string, mapping: Mapping) => targetCodeOf(locale, mapping) ?? locale.replace(/_/g, '-');
const sourceCode = (locale: string, mapping: Mapping) => sourceCodeOf(locale, mapping) ?? locale.replace(/_/g, '-');

async function findSchema(wix: Wix, schemaId: string): Promise<Schema | undefined> {
  return (await wix.schemas()).find((schema) => schema.id === schemaId);
}

async function contentOf(wix: Wix, schemaId: string, entityId: string, locale: string): Promise<Content | undefined> {
  const [content] = await wix.allContents({ schemaId: { $eq: schemaId }, entityId: { $eq: entityId }, locale: { $eq: locale } });
  return content;
}

export interface ExportRequest {
  schemaId: string;
  entityId: string;
  /** Wix locales of the target languages (HTML: exactly one). */
  locales: string[];
  format: FileFormat;
  mapping: Mapping;
}

export interface ExportedFile {
  filename: string;
  contentType: string;
  content: string;
}

/** Builds the file for one item; throws LocalizedError. */
export async function exportFile(wix: Wix, request: ExportRequest): Promise<ExportedFile> {
  const languages = await siteLanguages(wix);
  const targets = new Set(languages.targets.map((locale) => locale.id));
  const locales = [...new Set(request.locales)].filter((locale) => targets.has(locale));
  if (locales.length === 0) throw new LocalizedError('Select at least one language.', 'file_select_language');
  if (request.format === 'html' && locales.length !== 1) {
    throw new LocalizedError('An HTML file holds exactly one language.', 'file_html_one_language');
  }
  const schema = await findSchema(wix, request.schemaId);
  if (!schema) throw new LocalizedError('This content type no longer exists on the site.', 'schemaMissing');
  const source = await contentOf(wix, schema.id, request.entityId, languages.primary.id);
  if (!source) throw new LocalizedError('The original text of this item was not found.', 'sourceMissing');
  // Everything translatable, also fields translated already: whether those are
  // replaced is decided on import (Overwrite existing translations).
  const { segments } = collectSegments(schema, source, undefined, true);
  if (segments.length === 0) throw new LocalizedError('Nothing to translate.', 'nothing_to_translate');

  const jobs: FileJob[] = locales.map((locale) => ({
    plugin: PLUGIN,
    reference: fileReference(schema.id, source.entityId, locale),
    sourceLanguage: sourceCode(languages.primary.id, request.mapping),
    targetLanguage: targetCode(locale, request.mapping),
    segments,
  }));
  const name = locales.length === 1 ? `wix-${source.entityId}-${jobs[0].targetLanguage}` : `wix-${source.entityId}`;
  return request.format === 'html'
    ? { filename: `${name}.html`, contentType: 'text/html; charset=utf-8', content: TranslationFiles.exportHtml(jobs[0]) }
    : { filename: `${name}.xlf`, contentType: 'application/x-xliff+xml', content: TranslationFiles.exportXliff(jobs) };
}

export interface ImportOptions {
  /** Also write texts whose source changed since the export (off by default). */
  includeChanged: boolean;
  /** Replace current translations (as on the translate page); otherwise they are kept. */
  overwrite: boolean;
  /** The site's *publish* setting: mark the translations as ready to publish. */
  publish: boolean;
}

export type ImportCounts = Record<ImportStatus, number>;

/** What happened to one job (one item in one language) of the file. */
export interface ImportSummary {
  reference: string;
  title: string | null;
  /** The language's name, else the Wix locale. */
  language: string | null;
  counts: ImportCounts;
  /** Segments written to Wix. */
  written: number;
  /** Translated, but the source changed since the export, and not written. */
  skippedChanged: number;
  /** Fields left alone because they are translated already and Overwrite wasn't ticked. */
  kept: number;
  /** Not written: too long for the field, or other blocks of the same rich text missing. */
  notWritten: number;
  error?: ErrorInfo;
}

const emptyCounts = (): ImportCounts => ({ ok: 0, source_changed: 0, untranslated: 0, invalid_markup: 0, missing: 0 });

/** The SDK's file errors as messages the user can read in their language. */
export function fileError(error: unknown): LocalizedError {
  if (error instanceof TranslationFileError) {
    const code = error.code === 'too_large' ? 'file_too_large' : error.code === 'missing_metadata' ? 'file_missing_metadata' : 'file_invalid';
    return new LocalizedError(error.message, code);
  }
  return error instanceof LocalizedError ? error : new LocalizedError(String(error), 'file_invalid');
}

/**
 * Reads an uploaded file and writes its translations back, job by job. File errors
 * are thrown; a job that can't be imported gets an `error` and the others go on.
 */
export async function importFile(wix: Wix, content: string, options: ImportOptions): Promise<ImportSummary[]> {
  let files;
  try {
    files = TranslationFiles.read(content);
  } catch (error) {
    throw fileError(error);
  }
  const languages = await siteLanguages(wix);
  const schemas = await wix.schemas();
  const summaries: ImportSummary[] = [];
  for (const file of files) {
    const summary: ImportSummary = {
      reference: file.reference,
      title: null,
      language: null,
      counts: emptyCounts(),
      written: 0,
      skippedChanged: 0,
      kept: 0,
      notWritten: 0,
    };
    summaries.push(summary);
    try {
      if (file.plugin !== PLUGIN) {
        throw new LocalizedError(`This file belongs to another system (${file.plugin}).`, 'file_other_system', { plugin: file.plugin });
      }
      const ref = parseReference(file.reference);
      if (!ref) throw new LocalizedError('The item this file was exported from no longer exists.', 'file_item_gone');
      const locale = languages.targets.find((candidate) => candidate.id === ref.locale);
      summary.language = locale ? localeName(locale) : ref.locale;
      if (!locale) throw new LocalizedError(`The site has no language ${ref.locale}.`, 'file_no_language', { language: ref.locale });
      const schema = schemas.find((candidate) => candidate.id === ref.schemaId);
      const source = schema && (await contentOf(wix, schema.id, ref.entityId, languages.primary.id));
      if (!schema || !source) throw new LocalizedError('The item this file was exported from no longer exists.', 'file_item_gone');
      summary.title = entityTitle(schema, source);
      const target = await contentOf(wix, schema.id, ref.entityId, locale.id);

      // The same segments the API translation would send: current translations stay unless Overwrite.
      const collected = collectSegments(schema, source, target, options.overwrite);
      summary.kept = collected.plan.kept;
      const translated = new Map<string, string>();
      for (const result of TranslationFiles.importTranslations(file, collected.segments)) {
        summary.counts[result.status]++;
        const write = result.status === 'ok' || (result.status === 'source_changed' && options.includeChanged);
        if (write && result.text !== null && result.text.trim() !== '') translated.set(result.key, result.text);
      }
      summary.skippedChanged = options.includeChanged ? 0 : summary.counts.source_changed;
      const built = buildFields(collected, translated, options.publish);
      await saveFields(wix, schema, source, target, locale.id, built.fields);
      const writtenKeys = new Set(
        collected.parts.filter((part) => part.field.key in built.fields).flatMap((part) => part.keys),
      );
      summary.written = [...translated.keys()].filter((key) => writtenKeys.has(key)).length;
      summary.notWritten = translated.size - summary.written;
    } catch (error) {
      summary.error = errorInfo(error);
    }
  }
  return summaries;
}
