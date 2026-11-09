import type { Politeness, SegmentInput, SupertextClient } from '../supertext/index.js';
import type { Content, ContentField, Schema, WixClient } from '../wix/client.js';
import { extractRicos, type RicosExtraction } from '../wix/ricos.js';
import { planFields, type FieldPlan, type PlannedField } from './fields.js';

/**
 * One entity (a product, a blog post …) into one locale: read the original
 * content, send the fields that need translating to Supertext (the SDK packs
 * them into as few documents as possible, one segment per text field, HTML
 * field or rich-text block), write the translations back to Wix Multilingual.
 */

export interface TranslateEntityOptions {
  wix: Pick<WixClient, 'saveContent'>;
  supertext: Pick<SupertextClient, 'translateTexts'>;
  schema: Schema;
  source: Content;
  /** The entity's current content in the target locale, if any. */
  target?: Content;
  locale: string;
  supertextTarget: string;
  sourceLanguage: string;
  politeness?: Politeness;
  overwrite: boolean;
  /** Mark the translations as ready to publish on the live site. */
  publish: boolean;
}

export interface EntityResult {
  /** Fields written. */
  written: number;
  /** Fields that were translated already and kept. */
  kept: number;
  /** Fields whose translation exceeded the schema's maximum length. */
  tooLong: number;
}

interface Part {
  field: PlannedField;
  /** Keys of the field's segments: the field key, or `<field key>#<n>` for rich-text blocks. */
  keys: string[];
  ricos?: RicosExtraction;
}

/** A segment with the key it has in translation files and in `translateTexts`. */
export interface KeyedSegment {
  key: string;
  text: string;
  html: boolean;
}

/** The segments of one entity, and how to put their translations back. */
export interface CollectedEntity {
  plan: FieldPlan;
  segments: KeyedSegment[];
  parts: Part[];
}

/**
 * The segments to translate (the API translation and translation files share it):
 * one per text or HTML field (key = the Wix field key), one per Ricos text block
 * (key = `<field key>#<n>`, n counting the field's blocks from 0).
 */
export function collectSegments(schema: Schema, source: Content, target: Content | undefined, overwrite: boolean): CollectedEntity {
  const plan = planFields(schema, source, target, overwrite);
  const segments: KeyedSegment[] = [];
  const parts: Part[] = plan.fields.map((field) => {
    if (field.kind === 'ricos') {
      const ricos = extractRicos(field.source.richContent!);
      const keys = ricos.segments.map((_, index) => `${field.key}#${index}`);
      ricos.segments.forEach((segment, index) => segments.push({ key: keys[index], text: segment.text, html: segment.html }));
      return { field, keys, ricos };
    }
    segments.push({ key: field.key, text: field.source.textValue ?? '', html: field.kind === 'html' });
    return { field, keys: [field.key] };
  });
  return { plan, segments, parts };
}

export interface BuiltFields {
  fields: Record<string, ContentField>;
  /** Fields whose translation exceeded the schema's maximum length. */
  tooLong: number;
  /** Translated rich-text blocks not written because other blocks of the same field have no translation. */
  incomplete: number;
}

/**
 * The Wix content fields for the translations by segment key. A rich-text field
 * is written only when every block of it has a translation (otherwise its other
 * blocks would be overwritten with the original text).
 */
export function buildFields(collected: CollectedEntity, translated: ReadonlyMap<string, string>, publish: boolean): BuiltFields {
  const fields: Record<string, ContentField> = {};
  let tooLong = 0;
  let incomplete = 0;
  for (const part of collected.parts) {
    const present = part.keys.filter((key) => translated.has(key));
    if (present.length === 0) continue;
    let value: ContentField;
    if (part.ricos) {
      if (present.length < part.keys.length) {
        incomplete += present.length;
        continue;
      }
      const map = new Map<number, string>();
      part.keys.forEach((key, index) => map.set(index, translated.get(key)!));
      value = { richContent: part.ricos.rebuild(map) };
    } else {
      const text = translated.get(part.keys[0])!;
      const max = part.field.schemaField.maxLength;
      if (max && text.length > max) {
        tooLong++;
        continue;
      }
      value = { textValue: text };
    }
    fields[part.field.key] = { ...value, published: publish, updatedBy: 'EXTERNAL_APP' };
  }
  return { fields, tooLong, incomplete };
}

/** Writes translated fields of one entity into a locale (creates the translation if there is none yet). */
export async function saveFields(
  wix: Pick<WixClient, 'saveContent'>,
  schema: Schema,
  source: Content,
  target: Content | undefined,
  locale: string,
  fields: Record<string, ContentField>,
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  await wix.saveContent(
    {
      schemaId: schema.id,
      entityId: source.entityId,
      locale,
      fields,
      ...(source.parentEntityId ? { parentEntityId: source.parentEntityId } : {}),
    },
    target !== undefined,
  );
}

export async function translateEntity(options: TranslateEntityOptions): Promise<EntityResult> {
  const { schema, source, target, overwrite } = options;
  const collected = collectSegments(schema, source, target, overwrite);
  if (collected.segments.length === 0) {
    return { written: 0, kept: collected.plan.kept, tooLong: 0 };
  }
  // The SDK fails with `incomplete_response` if any segment comes back missing.
  const translated = await options.supertext.translateTexts(
    new Map<string, SegmentInput>(collected.segments.map((segment) => [segment.key, { text: segment.text, html: segment.html }])),
    options.supertextTarget,
    {
      sourceLang: options.sourceLanguage,
      ...(options.politeness ? { politeness: options.politeness } : {}),
    },
  );
  const { fields, tooLong } = buildFields(collected, translated, options.publish);
  await saveFields(options.wix, schema, source, target, options.locale, fields);
  return { written: Object.keys(fields).length, kept: collected.plan.kept, tooLong };
}
