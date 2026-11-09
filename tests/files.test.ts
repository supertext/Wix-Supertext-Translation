import { describe, expect, it } from 'vitest';
import { TranslationFiles } from '../src/supertext/index.js';
import { fileReference, MAX_UPLOAD_BYTES, parseReference, PLUGIN, refuseLargeUpload, type ImportSummary } from '../src/translation/files.js';
import { setup } from './helpers.js';
import { CATEGORIES, PRODUCTS } from './standin/seed.js';

type Env = ReturnType<typeof setup>;

const exportFile = async (env: Env, body: Record<string, unknown>) => {
  const response = await env.request('/api/files/export?locale=en', {
    method: 'POST',
    body: JSON.stringify({ format: 'xliff', ...body }),
    headers: { 'Content-Type': 'application/json' },
  });
  return { response, text: await response.text() };
};

const importFile = async (env: Env, content: string, fields: Record<string, string> = {}) => {
  const form = new FormData();
  form.set('file', new File([content], 'translated.xlf'));
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const response = await env.request('/api/files/import?locale=en', { method: 'POST', body: form });
  return { status: response.status, json: (await response.json()) as { summaries?: ImportSummary[]; html?: string; error?: { code?: string }; text?: string } };
};

const content = (env: Env, entityId: string, locale: string) =>
  env.wix.contents.find((candidate) => candidate.entityId === entityId && candidate.locale === locale);

/** A translator: copies every XLIFF source into a target with "[fr] " in front. */
const translateXliff = (xliff: string) =>
  xliff.replace(/<source>([\s\S]*?)<\/source>/g, (_m, inner: string) => `<source>${inner}</source><target>[fr] ${inner}</target>`);

describe('references', () => {
  it('round-trips schema, entity and Wix locale', () => {
    const reference = fileReference(PRODUCTS, 'prod-praline-box', 'fr-CH');
    expect(reference).toBe(`${PRODUCTS}:prod-praline-box:fr-CH`);
    expect(parseReference(reference)).toEqual({ schemaId: PRODUCTS, entityId: 'prod-praline-box', locale: 'fr-CH' });
    expect(parseReference('page:12')).toBeNull();
    expect(parseReference('')).toBeNull();
  });
});

describe('export for translation', () => {
  it('exports the segments the API translation sends, with field keys, block keys and the mapped codes', async () => {
    const env = setup();
    const { response, text } = await exportFile(env, { schemaId: PRODUCTS, entityIds: ['prod-praline-box'], locales: ['de-CH', 'fr-CH'] });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/x-xliff+xml');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="wix-prod-praline-box.xlf"');
    const jobs = TranslationFiles.read(text);
    expect(jobs.map((job) => [job.plugin, job.reference, job.sourceLanguage, job.targetLanguage])).toEqual([
      [PLUGIN, `${PRODUCTS}:prod-praline-box:de-CH`, 'en', 'de-CH'],
      [PLUGIN, `${PRODUCTS}:prod-praline-box:fr-CH`, 'en', 'fr-CH'],
    ]);
    const keys = jobs[0].units.map((unit) => unit.key);
    expect(keys.slice(0, 2)).toEqual(['name', 'description#0']);
    expect(keys).toContain('choice(small)');
    expect(keys).toContain('seoDescription');
    expect(keys).not.toContain('mainImage');
  });

  it('exports one language as HTML, also an unmapped one, and refuses HTML with several', async () => {
    const env = setup();
    const html = await exportFile(env, { schemaId: CATEGORIES, entityIds: ['cat-swiss-chocolate'], locales: ['it-CH'], format: 'html' });
    expect(html.response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(html.response.headers.get('content-disposition')).toContain('wix-cat-swiss-chocolate-it-CH.html');
    // Translated fields are exported too (the import decides whether they are replaced).
    expect(TranslationFiles.read(html.text)[0].units.map((unit) => unit.key)).toEqual(['name', 'description']);

    const several = await exportFile(env, { schemaId: CATEGORIES, entityIds: ['cat-swiss-chocolate'], locales: ['de-CH', 'fr-CH'], format: 'html' });
    expect(several.response.status).toBe(400);
    expect(JSON.parse(several.text).error.code).toBe('file_html_one_language');
    const two = await exportFile(env, { schemaId: CATEGORIES, entityIds: ['cat-swiss-chocolate', 'x'], locales: ['de-CH'] });
    expect(JSON.parse(two.text).error.code).toBe('file_select_one');
    const gone = await exportFile(env, { schemaId: CATEGORIES, entityIds: ['nope'], locales: ['de-CH'] });
    expect(JSON.parse(gone.text).error.code).toBe('sourceMissing');
  });
});

describe('import translation', () => {
  it('writes the file through the same write-back as API translations, rich text included', async () => {
    const env = setup();
    const { text } = await exportFile(env, { schemaId: PRODUCTS, entityIds: ['prod-praline-box'], locales: ['fr-CH'] });
    const { status, json } = await importFile(env, translateXliff(text));
    expect(status).toBe(200);
    const [summary] = json.summaries!;
    expect(summary).toMatchObject({ title: 'Dark chocolate praline box', language: 'French (Switzerland)', kept: 0, skippedChanged: 0 });
    expect(summary.written).toBe(summary.counts.ok);
    const fr = content(env, 'prod-praline-box', 'fr-CH')!;
    expect(fr.fields.name).toEqual({ textValue: '[fr] Dark chocolate praline box', published: true, updatedBy: 'EXTERNAL_APP' });
    expect(fr.fields.description.richContent!.nodes[0].nodes![0].textData!.text).toBe('[fr] Made by hand in Bern');
    expect(json.html).toContain(`Imported: ${summary.written}`);
    expect(json.html).toContain('French (Switzerland)');
  });

  it('keeps current translations unless Overwrite, and skips source changes unless asked', async () => {
    const env = setup();
    const { text } = await exportFile(env, { schemaId: CATEGORIES, entityIds: ['cat-swiss-chocolate'], locales: ['de-CH'] });
    content(env, 'cat-swiss-chocolate', 'en-US')!.fields.description.textValue = '<p>Pralines from <strong>Zurich</strong>.</p>';

    const first = (await importFile(env, translateXliff(text))).json.summaries![0];
    expect(first).toMatchObject({ kept: 1, written: 0, skippedChanged: 1 });
    expect(first.counts.source_changed).toBe(1);
    expect(content(env, 'cat-swiss-chocolate', 'de-CH')!.fields.name.textValue).toBe('Schweizer Schokolade');

    const second = (await importFile(env, translateXliff(text), { overwrite: '1', includeChanged: '1' })).json.summaries![0];
    expect(second).toMatchObject({ kept: 0, written: 2, skippedChanged: 0 });
    expect(content(env, 'cat-swiss-chocolate', 'de-CH')!.fields.name.textValue).toBe('[fr] Swiss chocolate');
  });

  it("doesn't write untranslated, invalid or missing texts, nor a rich text with blocks missing", async () => {
    const env = setup();
    let { text } = await exportFile(env, { schemaId: PRODUCTS, entityIds: ['prod-praline-box'], locales: ['fr-CH'] });
    // Only the name and the first rich-text block are translated; the SEO text gets a foreign tag.
    text = text.replace('<source>Dark chocolate praline box</source>', '<source>Dark chocolate praline box</source><target>Boîte de pralinés</target>');
    text = text.replace(/(<trans-unit id="description#0"[^>]*>\s*<source>[\s\S]*?<\/source>)/, '$1<target>Fait main à Berne</target>');
    text = text.replace(/(<trans-unit id="seoDescription"[^>]*>\s*<source>[\s\S]*?<\/source>)/, '$1<target><ph id="9">&lt;img&gt;</ph>Douze</target>');
    // A field added after the export.
    content(env, 'prod-praline-box', 'en-US')!.fields['choice(large)'] = { textValue: 'Box of 24' };

    const [summary] = (await importFile(env, text)).json.summaries!;
    expect(summary.counts.ok).toBe(2);
    expect(summary.counts.invalid_markup).toBe(1);
    expect(summary.counts.missing).toBe(1);
    expect(summary.counts.untranslated).toBeGreaterThan(0);
    expect(summary.written).toBe(1);
    expect(summary.notWritten).toBe(1); // the rich-text block whose siblings aren't translated
    const fr = content(env, 'prod-praline-box', 'fr-CH')!;
    expect(fr.fields.name.textValue).toBe('Boîte de pralinés');
    expect(fr.fields.description).toBeUndefined();
    expect(fr.fields.seoDescription).toBeUndefined();
  });

  it('refuses files of other systems, unknown items and languages the site lacks', async () => {
    const env = setup();
    const job = (plugin: string, reference: string) => ({
      plugin, reference, sourceLanguage: 'en', targetLanguage: 'fr-CH', segments: [{ key: 'name', text: 'Swiss chocolate' }],
    });
    const file = TranslationFiles.exportXliff([
      job('Shopify-Supertext-Translation', `${CATEGORIES}:cat-swiss-chocolate:fr-CH`),
      job(PLUGIN, 'page:12'),
      job(PLUGIN, `${CATEGORIES}:gone:fr-CH`),
      job(PLUGIN, `${CATEGORIES}:cat-swiss-chocolate:ja-JP`),
    ]);
    const { json } = await importFile(env, file);
    expect(json.summaries!.map((summary) => [summary.error?.code, summary.error?.params])).toEqual([
      ['file_other_system', { plugin: 'Shopify-Supertext-Translation' }],
      ['file_item_gone', {}],
      ['file_item_gone', {}],
      ['file_no_language', { language: 'ja-JP' }],
    ]);
    expect(content(env, 'cat-swiss-chocolate', 'fr-CH')).toBeUndefined();
  });

  it('reports broken files and files without metadata in the interface language', async () => {
    const env = setup();
    const broken = await importFile(env, 'not a translation file');
    expect(broken.status).toBe(400);
    expect(broken.json.error?.code).toBe('file_invalid');
    expect(broken.json.text).toBe("This file isn't a valid XLIFF or HTML translation file.");
    const bare = await importFile(env, '<html><body><div data-st-id="0">x</div></body></html>');
    expect(bare.json.error?.code).toBe('file_missing_metadata');
  });

  it('writes an HTML file imported unchanged as the source text', async () => {
    const env = setup();
    const { text } = await exportFile(env, { schemaId: CATEGORIES, entityIds: ['cat-swiss-chocolate'], locales: ['fr-CH'], format: 'html' });
    const [summary] = (await importFile(env, text)).json.summaries!;
    expect(summary.written).toBe(2);
    expect(content(env, 'cat-swiss-chocolate', 'fr-CH')!.fields.name.textValue).toBe('Swiss chocolate');
  });
});

describe('upload size', () => {
  it('refuses uploads over 10 MB, by Content-Length before reading and by file size', async () => {
    expect(() => refuseLargeUpload(String(11 * 1024 * 1024))).toThrow(expect.objectContaining({ code: 'file_too_large' }));
    expect(() => refuseLargeUpload(undefined, { size: MAX_UPLOAD_BYTES + 1 })).toThrow(expect.objectContaining({ code: 'file_too_large' }));
    expect(() => refuseLargeUpload(String(MAX_UPLOAD_BYTES), { size: 10 })).not.toThrow();
    const env = setup();
    const response = await env.request('/api/files/import?locale=de', {
      method: 'POST',
      body: 'x',
      headers: { 'Content-Length': String(MAX_UPLOAD_BYTES * 2), 'Content-Type': 'multipart/form-data; boundary=x' },
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { text: string }).text).toBe('Die Datei ist zu groß (höchstens 10 MB).');
  });
});
