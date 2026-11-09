/**
 * Screenshots of the app's dashboard pages for the guides (docs/images), taken
 * with Playwright against the stand-in Wix and Supertext APIs, which return
 * real translations of the sample site (tests/standin/samples.json).
 *
 *   npm run docs:screenshots
 *
 * Chromium: Playwright's own (npx playwright install chromium), or CHROME=/path.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { mkdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { chromium, type Locator, type Page } from 'playwright';
import { signInstance } from '../../src/auth/instance.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { translator } from '../../src/i18n/index.js';
import { MemoryStore } from '../../src/store/store.js';
import { formatTime } from '../../src/views/layout.js';
import { createSupertextStandin } from '../standin/supertext.js';
import { createWixStandin } from '../standin/wix.js';

const out = new URL('../../docs/images/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const listen = (fetch: (request: Request) => Response | Promise<Response>) =>
  new Promise<string>((resolve) => {
    const server = serve({ fetch, port: 0, hostname: '127.0.0.1' }, () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });

const SECRET = 'screenshot-secret';
const INSTANCE = '7c3e1d2a-5b4f-4e6a-9c8d-0f1e2d3c4b5a';

async function main() {
  const wix = createWixStandin();
  const supertext = createSupertextStandin();
  const wixUrl = await listen((request) => wix.handle(request));
  const supertextUrl = await listen((request) => supertext.handle(request));
  // Translation review: a second stand-in address, never Supertext's real review service.
  const reviewUrl = await listen((request) => supertext.handle(request));
  const store = new MemoryStore();
  const app = createApp({
    config: loadConfig({
      WIX_APP_ID: 'screenshots',
      WIX_APP_SECRET: SECRET,
      WIX_API_BASE: wixUrl,
      SUPERTEXT_API_ENDPOINT: `${supertextUrl}/v1/`,
      SUPERTEXT_REVIEW_URL: `${reviewUrl}/v1/`,
      // Version reports go to the stand-in, never to the live Commando Center.
      SUPERTEXT_REPORT_URL: `${supertextUrl}/report`,
    }),
    store,
  });
  app.use('/static/*', serveStatic({ root: new URL('../../public/', import.meta.url).pathname, rewriteRequestPath: (path) => path.replace(/^\/static/, '') }));
  const appUrl = await listen(app.fetch);
  const instance = signInstance({ instanceId: INSTANCE, uid: 'editor', permissions: 'OWNER', siteOwnerId: 'editor' }, SECRET);
  const url = (path: string, params: Record<string, string> = {}) =>
    `${appUrl}${path}?${new URLSearchParams({ instance, locale: 'en', ...params })}`;

  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  const shot = async (name: string, target: Locator | Page = page) => {
    await target.screenshot({ path: `${out}${name}.png`, animations: 'disabled' });
    console.log(`docs/images/${name}.png`);
  };

  // Settings: no key yet, then a saved key and a successful connection test.
  await page.goto(url('/'));
  await shot('no-api-key', page.locator('.notice.warning').first());

  // Language mapping: a language with a default ("Portuguese" → pt-PT) and one without ("Swiss German").
  wix.locales.push(
    { id: 'pt', languageCode: 'pt', visibility: 'VISIBLE', displayName: 'Portuguese' },
    { id: 'gsw', languageCode: 'gsw', visibility: 'VISIBLE', displayName: 'Swiss German' },
  );
  // Translation review ticked for German (Switzerland).
  await store.saveSettings({ ...(await store.getSettings(INSTANCE)), reviewLocales: ['de-CH'] });
  await page.goto(url('/settings'));
  await shot('settings-languages', page.locator('section.card', { has: page.locator('table.codes') }));
  wix.locales.splice(-2);

  await page.goto(url('/settings'));
  await page.fill('input[name="apiKey"]', 'Supertext-Auth-Key 0123456789abcdef');
  await page.click('button.primary');
  await page.waitForSelector('.key-check[data-status="ok"]');
  await page.click('#test-button');
  await page.waitForSelector('#test-result.ok');
  // The key check's time changes with every run: show a fixed one, so the image only
  // changes when the page does.
  const checkedAt = translator('en').t('keyCheck.checkedAt', { time: formatTime('2026-10-01T09:00:00Z', 'en') });
  await page.locator('.key-check p.muted').evaluateAll((nodes, text) => nodes.forEach((node) => (node.textContent = text)), checkedAt);
  await shot('settings', page.locator('main'));

  // Translate page: products selected.
  await page.goto(url('/'));
  await page.check('#select-all');
  await page.uncheck('input[name="locale"][value="it-CH"]');
  await shot('translate-page', page.locator('main'));

  // Results after translating.
  await page.click('#translate-button');
  await page.waitForSelector('.job .notice.success', { timeout: 30_000 });
  await shot('translate-results', page.locator('.job'));

  // The list afterwards: translated products.
  await page.goto(url('/'));
  await shot('translated-state', page.locator('table.items'));

  // Categories: partly translated, overwrite warning.
  await page.goto(url('/', { type: '6a1f2c3d-0002-4000-8000-000000000002' }));
  await page.check('input[name="entity"]');
  await page.check('#overwrite');
  await shot('overwrite-warning', page.locator('#translate-form'));

  // Translation files: export the category as XLIFF, translate the file, import it.
  await page.goto(url('/', { type: '6a1f2c3d-0002-4000-8000-000000000002' }));
  await page.check('input[name="entity"]');
  await page.uncheck('input[name="export-locale"][value="it-CH"]');
  await shot('export-for-translation', page.locator('#export-card'));
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-button')]);
  const xliff = await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'));
  // A translator's work: the stand-in's translations of the sample texts.
  const translated = xliff
    .replace(/(target-language="fr-CH"[\s\S]*?<source>Swiss chocolate<\/source>)/, '$1<target>Chocolat suisse</target>')
    .replace(/(target-language="fr-CH"[\s\S]*?<trans-unit id="description"[^>]*>\s*<source>([\s\S]*?)<\/source>)/, (_m, head: string, source: string) =>
      `${head}<target>${source.replace('Handmade pralines, bars and truffles from our workshop in ', 'Pralinés, tablettes et truffes faits main dans notre atelier à ').replace('>Bern<', '>Berne<')}</target>`);
  await page.setInputFiles('#import-form input[name="file"]', { name: 'wix-cat-swiss-chocolate.xlf', mimeType: 'application/x-xliff+xml', buffer: Buffer.from(translated) });
  await page.click('#import-button');
  await page.waitForSelector('#import-result .notice');
  await shot('import-summary', page.locator('#import-form'));

  // The page in German (follows the dashboard language).
  await page.goto(url('/', { locale: 'de', type: '6a1f2c3d-0003-4000-8000-000000000003' }));
  await shot('translate-page-de', page.locator('#translate-form'));

  await browser.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
