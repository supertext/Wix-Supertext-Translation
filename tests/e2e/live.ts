/**
 * End-to-end test against the REAL Supertext API. There is no real Wix site in CI, so
 * Wix is the stand-in (tests/standin/wix.ts, the sample site of seed.ts) and the app is
 * the built Docker image (as on Railway) with a real SUPERTEXT_API_KEY. Like Wix, this
 * script opens the app's dashboard page with a signed instance; Playwright translates
 * every content type's items into every site language through the app's own UI; then
 * what the stand-in Wix received is checked: every item has content in each language,
 * fields are filled and changed, rich-text formatting and links are kept, no protocol
 * markup is left, the text is in the target language (de-CH without "ß"), and translating
 * again behaves as the app defines it (translated fields kept; with "overwrite", the same
 * contents updated, no duplicates). See "End-to-end tests" in docs/DEVELOPER.md.
 *
 *   APP_URL=http://127.0.0.1:8081 WIX_APP_SECRET=… npx tsx tests/e2e/live.ts
 *
 * The app must run with WIX_APP_SECRET, WIX_API_BASE=http://127.0.0.1:8766 (this
 * script serves the Wix stand-in there) and a fresh store. SUPERTEXT_STANDIN_PORT=8765
 * also serves the stand-in Supertext API (for trying the test without a key).
 */
import { serve } from '@hono/node-server';
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { signInstance } from '../../src/auth/instance.js';
import type { Content, ContentField, RichContent, RicosNode, Schema } from '../../src/wix/client.js';
import { createSupertextStandin } from '../standin/supertext.js';
import { createWixStandin } from '../standin/wix.js';

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  return value;
};
const APP = (process.env.APP_URL ?? 'http://127.0.0.1:8081').replace(/\/$/, '');
const SECRET = need('WIX_APP_SECRET');
const artifacts = new URL('./artifacts/', import.meta.url).pathname;
mkdirSync(artifacts, { recursive: true });

const failures: string[] = [];
function check(name: string, ok: boolean, detail = ''): boolean {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}
const note = (text: string) => console.log(`note ${text}`);

// Common words, to tell the target languages apart. Lower case, whole words.
const STOPWORDS: Record<string, string[]> = {
  en: ['the', 'and', 'is', 'are', 'with', 'for', 'you', 'your', 'our', 'of', 'to', 'we', 'who', 'what', 'from', 'in', 'by'],
  de: ['der', 'die', 'das', 'und', 'ist', 'sind', 'mit', 'für', 'sie', 'ihre', 'ihr', 'unser', 'unsere', 'unserer', 'wir', 'eine', 'ein', 'den', 'zu', 'von', 'was', 'aus', 'jede', 'ohne'],
  fr: ['le', 'la', 'les', 'et', 'est', 'sont', 'avec', 'pour', 'vous', 'votre', 'vos', 'notre', 'nos', 'nous', 'des', 'une', 'un', 'du', 'de', 'qui', 'que', 'au', 'aux', 'sans'],
  it: ['il', 'lo', 'la', 'gli', 'le', 'e', 'è', 'sono', 'con', 'per', 'lei', 'sua', 'suo', 'nostro', 'nostra', 'nostri', 'noi', 'una', 'un', 'del', 'della', 'di', 'che', 'chi', 'da', 'senza'],
};
const words = (text: string) => text.toLowerCase().match(/\p{L}+/gu) ?? [];
const score = (text: string, lang: string) => words(text).filter((word) => STOPWORDS[lang].includes(word)).length;
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;
const LEFTOVERS = ['data-st-id', 'data-st-ph', 'data-st-d', 'st-ph-', '<html', '<body'];

// --- Rich content (Ricos) helpers ----------------------------------------------------------
function walk(nodes: RicosNode[] | undefined, visit: (node: RicosNode) => void) {
  for (const node of nodes ?? []) {
    visit(node);
    walk(node.nodes, visit);
  }
}
function ricosText(doc: RichContent | undefined): string {
  const out: string[] = [];
  walk(doc?.nodes, (node) => {
    if (node.textData?.text) out.push(node.textData.text);
  });
  return out.join(' ');
}
/** Block structure (HEADING, PARAGRAPH, LIST_ITEM …) without the TEXT runs. */
function blocks(doc: RichContent | undefined): string {
  const out: string[] = [];
  walk(doc?.nodes, (node) => {
    if (node.type !== 'TEXT') out.push(node.type);
  });
  return out.join(',');
}
/** Decorations by type, links with their URL ("LINK https://…"). */
function decorations(doc: RichContent | undefined): Map<string, number> {
  const out = new Map<string, number>();
  walk(doc?.nodes, (node) => {
    for (const decoration of node.textData?.decorations ?? []) {
      const link = (decoration.linkData as { link?: { url?: string } } | undefined)?.link?.url;
      const key = link ? `LINK ${link}` : decoration.type;
      out.set(key, (out.get(key) ?? 0) + 1);
    }
  });
  return out;
}
const plain = (field: ContentField | undefined) =>
  field?.richContent ? ricosText(field.richContent) : (field?.textValue ?? '').replace(/<[^>]+>/g, ' ');

// Translated by the app: text, HTML and rich content; not images, hidden or display-only fields.
const TRANSLATED_TYPES = new Set(['SHORT_TEXT', 'LONG_TEXT', 'HTML', 'RICH_CONTENT']);
function translatableKeys(schema: Schema, content: Content): string[] {
  return Object.keys(content.fields).filter((key) => {
    const field = schema.fields[key] ?? schema.fields[key.replace(/\([^()]*\)/g, '()')];
    return field && TRANSLATED_TYPES.has(field.type) && !field.hidden && !field.displayOnly && plain(content.fields[key]).trim() !== '';
  });
}

// --- The stand-in Wix site -------------------------------------------------------------------
const wix = createWixStandin();
const wixPort = Number(process.env.WIX_STANDIN_PORT || 8766);
serve({ fetch: (request) => wix.handle(request), port: wixPort, hostname: '127.0.0.1' });
if (process.env.SUPERTEXT_STANDIN_PORT) {
  const supertext = createSupertextStandin();
  serve({ fetch: (request) => supertext.handle(request), port: Number(process.env.SUPERTEXT_STANDIN_PORT), hostname: '127.0.0.1' });
  note(`stand-in Supertext API on port ${process.env.SUPERTEXT_STANDIN_PORT} (not the real API)`);
}

const primary = wix.locales.find((locale) => locale.primaryLocale)!;
const targets = wix.locales.filter((locale) => !locale.primaryLocale);
const sources = structuredClone(wix.contents.filter((content) => content.locale === primary.id));
const before = structuredClone(wix.contents.filter((content) => content.locale !== primary.id));
const key = (content: Pick<Content, 'schemaId' | 'entityId' | 'locale'>) => `${content.schemaId}|${content.entityId}|${content.locale}`;
console.log(
  `Sample site: ${sources.length} items in ${primary.id} (${wix.schemas.map((schema) => schema.displayName).join(', ')}); targets: ${targets.map((locale) => locale.id).join(', ')}`,
);

// The dashboard page as Wix opens it: a signed instance in the URL. The app has no own
// accounts; Wix decides who may open the dashboard (see "Demo" in docs/DEVELOPER.md).
const instance = signInstance(
  { instanceId: 'e2e00000-0000-4000-8000-000000000001', uid: 'e2e-editor', permissions: 'OWNER', siteOwnerId: 'e2e-owner' },
  SECRET,
);
const url = (params: Record<string, string> = {}) => `${APP}/?${new URLSearchParams({ instance, locale: 'en', ...params })}`;

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, locale: 'en-US' });
page.setDefaultTimeout(30_000);

interface RunResult {
  translated: number;
  unchanged: number;
  failed: number;
}

/** Translates every item of a content type into every target language through the UI. */
async function translateAll(p: Page, schema: Schema, label: string, overwrite: boolean): Promise<RunResult | undefined> {
  const tag = `${label}: ${schema.displayName}`;
  await p.goto(url({ type: schema.id }));
  const form = p.locator('#translate-form');
  await form.waitFor();
  const errors = await p.locator('.notice.error').allTextContents();
  check(`${tag}: translate page without errors`, errors.length === 0, errors.join(' | '));
  await p.check('#select-all');
  for (const locale of targets) {
    const box = form.locator(`input[name="locale"][value="${locale.id}"]`);
    const mapped = (await box.locator('xpath=..').locator('code').count()) === 1;
    check(`${tag}: ${locale.id} has a Supertext language`, mapped);
    await box.check();
  }
  if (overwrite) {
    await p.check('#overwrite');
    check(`${tag}: overwrite warning shown`, await p.locator('#overwrite-warning').isVisible());
  }
  // The page shows the site's previous job until the new one reports: mark it as old.
  await p.evaluate(() => document.querySelectorAll('#job-panel .job').forEach((node) => node.setAttribute('data-e2e-old', '')));
  const started = Date.now();
  await p.click('#translate-button');
  const result = p.locator('#job-panel .job:not([data-e2e-old]) .notice');
  try {
    await p.waitForFunction(
      () => document.querySelector('#job-panel .job:not([data-e2e-old]) .notice') || document.getElementById('form-message')?.textContent?.trim(),
      undefined,
      { timeout: 900_000, polling: 1000 },
    );
  } catch {
    check(`${tag}: job finished`, false, await p.locator('#job-panel').innerText().catch(() => ''));
    return undefined;
  }
  const message = (await p.locator('#form-message').textContent())?.trim();
  if (!check(`${tag}: job started`, !message, message ?? '')) return undefined;
  const file = `${label}-${schema.key.entityType}.png`;
  await p.screenshot({ path: `${artifacts}${file}`, fullPage: true });
  const summary = (await result.innerText()).replace(/\s+/g, ' ').trim();
  console.log(`${tag}: ${Math.round((Date.now() - started) / 1000)} s — ${summary}`);
  const failedItems = await p.locator('#job-panel .result.failed').allTextContents();
  check(`${tag}: no errors shown`, !(await result.getAttribute('class'))!.includes('error') && failedItems.length === 0, [summary, ...failedItems].join(' | '));
  const numbers = /(\d+)\D+(\d+)\D+(\d+)/.exec(summary);
  if (!check(`${tag}: job done`, numbers !== null, summary)) return undefined;
  return { translated: Number(numbers![1]), unchanged: Number(numbers![2]), failed: Number(numbers![3]) };
}

const find = (schemaId: string, entityId: string, locale: string) =>
  wix.contents.filter((content) => content.schemaId === schemaId && content.entityId === entityId && content.locale === locale);
const expectedItems = (schema: Schema) => sources.filter((content) => content.schemaId === schema.id).length * targets.length;

try {
  // --- First translation ---------------------------------------------------------------------
  for (const schema of wix.schemas) {
    const run = await translateAll(page, schema, 'first-run', false);
    if (run) check(`first-run: ${schema.displayName}: every item translated`, run.translated === expectedItems(schema) && run.failed === 0, JSON.stringify(run));
  }

  // The list afterwards: every item translated in every language.
  for (const schema of wix.schemas) {
    await page.goto(url({ type: schema.id }));
    const badges = await page.locator('table.items .badge').evaluateAll((nodes) => nodes.map((node) => node.className));
    const done = badges.filter((name) => name.includes('done')).length;
    check(`list: ${schema.displayName} shown as translated`, done === badges.length && done === expectedItems(schema), `${done}/${badges.length}`);
  }

  for (const locale of targets) {
    const lang = (locale.languageCode ?? locale.id.split("-")[0]).toLowerCase();
    let fields = 0;
    let changed = 0;
    let text = '';
    for (const source of sources) {
      const schema = wix.schemas.find((candidate) => candidate.id === source.schemaId)!;
      const tag = `${locale.id}: ${schema.key.entityType} ${source.entityId}`;
      const copies = find(source.schemaId, source.entityId, locale.id);
      if (!check(`${tag}: one translation content`, copies.length === 1, `${copies.length}`)) continue;
      const target = copies[0];
      const earlier = before.find((content) => key(content) === key(target));
      for (const field of translatableKeys(schema, source)) {
        const s = source.fields[field];
        const t = target.fields[field];
        const handMade = earlier?.fields[field];
        if (handMade && plain(handMade).trim()) {
          // Translated before (by hand): the app keeps it unless "overwrite" is chosen.
          check(`${tag}.${field}: existing translation kept`, JSON.stringify(t) === JSON.stringify(handMade), plain(t));
          continue;
        }
        fields++;
        if (!check(`${tag}.${field} filled`, plain(t).trim() !== '')) continue;
        check(`${tag}.${field}: published and marked as the app's`, t.published === true && t.updatedBy === 'EXTERNAL_APP', `${t.published}/${t.updatedBy}`);
        if (plain(t) !== plain(s)) changed++;
        else note(`${tag}.${field} unchanged: "${plain(t)}"`);
        text += ` ${plain(t)}`;
        const raw = JSON.stringify(t);
        const left = LEFTOVERS.filter((leftover) => raw.includes(leftover));
        check(`${tag}.${field}: no protocol markup left`, left.length === 0, left.join(', '));
        if (s.richContent) {
          check(`${tag}.${field}: no HTML tags in rich-text runs`, !/<\/?[a-z][^>]*>/i.test(ricosText(t.richContent)));
          check(`${tag}.${field}: same blocks (headings, paragraphs, lists)`, blocks(t.richContent) === blocks(s.richContent), blocks(t.richContent));
          const want = decorations(s.richContent);
          const got = decorations(t.richContent);
          for (const [decoration, n] of want) {
            check(`${tag}.${field}: keeps ${decoration}`, (got.get(decoration) ?? 0) >= 1, `${got.get(decoration) ?? 0}/${n}`);
          }
        } else if (schema.fields[field]?.type === 'HTML') {
          for (const [what, needle] of [['links', '<a '], ['bold', '<strong'], ['bold', '<b>'], ['italics', '<em'], ['paragraphs', '<p']]) {
            const n = count(s.textValue ?? '', needle);
            if (n) check(`${tag}.${field}: keeps its ${what}`, count(t.textValue ?? '', needle) === n, `${count(t.textValue ?? '', needle)}/${n}`);
          }
        }
      }
    }
    check(`${locale.id}: texts were changed by the translation`, fields > 0 && changed / fields >= 0.8, `${changed}/${fields} fields`);
    if (STOPWORDS[lang]) {
      const scores = Object.fromEntries(Object.keys(STOPWORDS).map((l) => [l, score(text, l)]));
      const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
      check(`${locale.id}: text is in the target language`, best === lang, JSON.stringify(scores));
    }
    if (/^de-ch$/i.test(locale.id)) check(`${locale.id}: Swiss German spelling (no "ß")`, !text.includes('ß'));
  }
  const firstRun = structuredClone(wix.contents);

  // --- Translating again, without "overwrite": translated fields are kept -----------------------
  for (const schema of wix.schemas) {
    const run = await translateAll(page, schema, 'again', false);
    if (run) check(`again: ${schema.displayName}: nothing retranslated`, run.translated === 0 && run.unchanged === expectedItems(schema), JSON.stringify(run));
  }
  check('again: contents unchanged', JSON.stringify(wix.contents) === JSON.stringify(firstRun));

  // --- With "overwrite": the same contents are updated in place --------------------------------
  const created = wix.log.filter((line) => line === 'POST /translation-content/v1/contents').length;
  for (const schema of wix.schemas) {
    const run = await translateAll(page, schema, 'overwrite', true);
    if (run) check(`overwrite: ${schema.displayName}: every item translated again`, run.translated === expectedItems(schema) && run.failed === 0, JSON.stringify(run));
  }
  check('overwrite: no new contents created', wix.log.filter((line) => line === 'POST /translation-content/v1/contents').length === created);
  check('overwrite: same number of contents (no duplicates)', wix.contents.length === firstRun.length, `${firstRun.length} → ${wix.contents.length}`);
  for (const content of before) {
    for (const [field, value] of Object.entries(content.fields)) {
      const now = find(content.schemaId, content.entityId, content.locale)[0]?.fields[field];
      check(`overwrite: ${content.locale} ${content.entityId}.${field} replaced by the app`, now?.updatedBy === 'EXTERNAL_APP' && plain(now).trim() !== '', `${plain(value)} → ${plain(now)}`);
    }
  }
} catch (error) {
  await page.screenshot({ path: `${artifacts}error.png`, fullPage: true }).catch(() => undefined);
  check('test ran to the end', false, String((error as Error)?.stack ?? error));
}

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll end-to-end checks passed.');
process.exit(0);
