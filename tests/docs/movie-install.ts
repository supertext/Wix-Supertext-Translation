/**
 * Records the install and configuration movie (a narrated MP4 that isn't committed) with the shared
 * Supertext movie kit (movie/movie-kit.mjs), against the stand-in Wix and Supertext APIs like
 * tests/docs/screenshots.ts: the app's dashboard page without a key, then Settings (a fake API key,
 * the language mapping, Save with the key check, Test connection) and where editors translate.
 * A hosted app has no install commands; adding it to a site happens in Wix's own screens, which
 * aren't shown (the narration sums it up). See docs/DEVELOPER.md → Demo movie.
 *
 *   npm run docs:movie:install
 *
 * MOVIE_OUT: where the MP4 goes (default tests/docs/movie/out/Wix-Supertext-Translation-install.mp4, git-ignored).
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Locator } from 'playwright';
import { MovieKit } from './movie/movie-kit.mjs';
import { startDemo } from './movie/env.js';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const mp4 = process.env.MOVIE_OUT ?? here('movie/out/Wix-Supertext-Translation-install.mp4');
mkdirSync(dirname(mp4), { recursive: true });
const workDir = mkdtempSync(join(tmpdir(), 'wix-install-movie-'));

const { url } = await startDemo();
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'en-US' });
page.setDefaultTimeout(60_000);
await page.goto(url('/'));
await page.locator('#translate-form').waitFor();
await page.waitForTimeout(800);

const scrollTo = async (locator: Locator, block: ScrollLogicalPosition = 'start') => {
  await locator.evaluate((el, block) => el.scrollIntoView({ block, behavior: 'smooth' }), block);
  await page.waitForTimeout(900);
};

const kit = await MovieKit.start(page, { workDir, assets: here('movie/assets'), voiceCache: here('movie/voice') });

// 1. Added to the site (Wix's own screens, not shown): the app opens in the dashboard.
await kit.say('Supertext for Wix is a hosted app: there is nothing to install. Add it to your site in Wix, and it opens in your dashboard.', {
  caption: 'Add the app to your Wix site: it opens in the <b>dashboard</b>',
  during: () => kit.moveTo(page.locator('h1')),
});
await kit.say('Your site needs Wix Multilingual with its languages set up. The app asks for an API key first.', {
  caption: 'Languages come from <b>Wix Multilingual</b>. First: an API key',
  during: () => kit.moveTo(page.locator('.notice.warning strong').first()),
});
await kit.say('Open Settings.', {
  caption: 'Open <b>Settings</b>',
  during: async () => {
    await kit.click(page.locator('nav a').filter({ hasText: 'Settings' }).first());
    await page.locator('input[name="apiKey"]').waitFor();
  },
});

// 2. The API key.
const key = page.locator('input[name="apiKey"]');
await kit.say('Paste your Supertext API key.', {
  caption: 'Paste your <b>Supertext API key</b>',
  during: () => kit.type(key, 'st-demo-0000-0000-0000'),
});
await kit.say('Generate it at supertext.com, Integrations, API. No account yet? Create one at supertext.com.', {
  caption: 'Generate your API key at <b>supertext.com → Integrations → API</b>. No account yet? Create one at supertext.com.',
  during: () => kit.moveTo(page.locator('section.card').first().locator('p.help a').last()),
});

// 3. Languages: each site language and its Supertext language.
const deRow = page.locator('table.codes tbody tr:has(#target-de-CH)');
await kit.say('Under Languages, each language of your site gets a Supertext language. English is the main language.', {
  caption: '<b>Languages</b>: map each site language',
  during: async () => {
    await scrollTo(page.locator('section.card', { has: page.locator('table.codes') }));
    await kit.moveTo(page.locator('table.codes tbody tr').first().locator('select'));
  },
});
const deSelect = deRow.locator('select');
await kit.say('For German, Switzerland, the app suggests Swiss German, de-CH. Pick another variant from the list if you need one.', {
  caption: 'German (Switzerland) → <b>German (Switzerland) (de-CH)</b>',
  during: async () => {
    await kit.moveTo(deSelect);
    await deSelect.selectOption('de-CH');
    await kit.hold(600);
  },
});
if ((await deSelect.inputValue()) !== 'de-CH') throw new Error('German is not mapped to de-CH');
await kit.say('Translation review can be ticked for each language. Leave it off for now.', {
  caption: '<b>Translation review</b>: optional, per language',
  during: () => kit.moveTo(deRow.locator('input[type="checkbox"]')),
});

// 4. Save: the key is checked; then Test connection.
const save = page.locator('form.settings > .actions button.primary');
await kit.say('Click Save. The app checks the key: it works.', {
  caption: 'Click <b>Save</b>: the API key works',
  during: async () => {
    await scrollTo(save, 'center');
    await kit.click(save);
    await page.waitForSelector('.key-check[data-status="ok"]');
    await kit.moveTo(page.locator('.key-check'));
  },
});
await kit.say('Test connection checks it again at any time.', {
  caption: '<b>Test connection</b>: connected',
  during: async () => {
    await kit.click(page.locator('#test-button'));
    await page.waitForSelector('#test-result.ok');
    await kit.moveTo(page.locator('#test-result'));
  },
});

// 5. Where editors translate.
await kit.say('Done. Editors now translate products, categories and blog posts under Translate.', {
  caption: 'Editors translate under <b>Translate with Supertext</b>',
  during: async () => {
    await kit.click(page.locator('nav a').filter({ hasText: 'Translate' }).first());
    await page.locator('#translate-form').waitFor();
    await kit.moveTo(page.locator('h1'));
  },
});
await kit.caption('');

await kit.finish(mp4, { system: 'Wix', repo: 'Wix-Supertext-Translation', kind: 'install' });
await browser.close();
rmSync(workDir, { recursive: true, force: true });
console.log(`Saved ${mp4}`);
process.exit(0);
