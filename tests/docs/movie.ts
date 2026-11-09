/**
 * Records the README's demo movie (docs/images/demo.gif, plus a narrated MP4 that isn't committed)
 * with the shared Supertext movie kit (movie/movie-kit.mjs), against the stand-in Wix and Supertext
 * APIs (real translations of the sample site), like tests/docs/screenshots.ts.
 * See docs/DEVELOPER.md → Demo movie.
 *
 *   npm run docs:movie
 *
 * MOVIE_OUT: where the MP4 goes (default tests/docs/movie/out/Wix-Supertext-Translation.mp4, git-ignored).
 * MOVIE_PORT: the app's port (default 8798). Chromium: Playwright's own, or CHROME=/path.
 */
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Locator } from 'playwright';
import { MovieKit } from './movie/movie-kit.mjs';
import { startDemo } from './movie/env.js';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const mp4 = process.env.MOVIE_OUT ?? here('movie/out/Wix-Supertext-Translation.mp4');
mkdirSync(dirname(mp4), { recursive: true });
const gif = here('../../docs/images/demo.gif');
const workDir = mkdtempSync(join(tmpdir(), 'wix-movie-'));

// The Supertext stand-in holds each status answer, so the waiting state is visible (the movie cuts it).
const { url } = await startDemo({ statusDelayMs: 2500 });
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'en-US' });
page.setDefaultTimeout(60_000);

// Set up (not recorded): a fake key, saved on the settings page.
await page.goto(url('/settings'));
await page.fill('input[name="apiKey"]', 'st-demo-0000-0000-0000');
await page.click('form.settings button.primary');
await page.waitForSelector('.key-check[data-status="ok"]');
await page.goto(url('/'));
await page.locator('#translate-form').waitFor();
await page.waitForTimeout(800);

const scrollTo = async (locator: Locator, block: ScrollLogicalPosition = 'start') => {
  await locator.evaluate((el, block) => el.scrollIntoView({ block, behavior: 'smooth' }), block);
  await page.waitForTimeout(900);
};

const kit = await MovieKit.start(page, { workDir, assets: here('movie/assets'), voiceCache: here('movie/voice') });

// 1. The product in English.
const row = page.locator('table.items tbody tr').filter({ hasText: 'Dark chocolate praline box' });
await kit.say('This is Supertext in the Wix dashboard. Here are the products of a Wix store, in English.', {
  caption: 'A product in English',
  during: () => kit.moveTo(row.locator('td.title')),
});

// 2. Pick it and the language.
await kit.say('Tick the product you want to translate.', {
  caption: '<b>Choose what to translate</b>: tick the product',
  during: () => kit.click(row.locator('input[name="entity"]')),
});
await kit.say('Keep German ticked, and untick French and Italian for now.', {
  caption: 'Choose the language: <b>German</b>',
  during: async () => {
    await scrollTo(page.locator('#translate-form .languages'), 'center');
    await kit.click(page.locator('#translate-form label.language').filter({ hasText: 'French' }).locator('input'));
    await kit.click(page.locator('#translate-form label.language').filter({ hasText: 'Italian' }).locator('input'));
    await kit.moveTo(page.locator('#translate-form label.language').filter({ hasText: 'German' }));
  },
});

// 3. Translate.
const button = page.locator('#translate-button');
await kit.say('Then click Translate with Supertext.', {
  caption: 'Click <b>Translate 1 item with Supertext</b>',
  during: () => kit.click(button),
});

// 4. Waiting.
await kit.say('Supertext translates the content.', {
  caption: 'Supertext translates the content…',
  during: async () => {
    await page.locator('.job .progress').waitFor();
    await scrollTo(page.locator('#job-panel'), 'center');
  },
});
kit.pause();
await page.locator('.job .notice.success').waitFor({ timeout: 60_000 });
await page.locator('.job').evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(600);
kit.resume();

// 5. The result: the German translation is saved in Wix Multilingual.
await kit.say('A few seconds later, the German translation is saved in Wix Multilingual.', {
  caption: 'Done: the product is translated into <b>German</b>',
  during: () => kit.moveTo(page.locator('.job .results .result.translated').first()),
});
await kit.say('Review it in the Translation Manager, and publish it as usual.', {
  caption: 'Review it in the <b>Translation Manager</b> and publish',
  during: () => kit.moveTo(page.locator('.job .notice.success strong')),
});
// The list as the editor sees it next time (reloaded: the badges show the state in Wix).
await page.goto(url('/'));
await page.locator('#translate-form').waitFor();
await kit.say('The list now shows the product as translated into German.', {
  caption: 'The product now has a German version',
  during: () => kit.moveTo(page.locator('table.items tbody tr').filter({ hasText: 'Dark chocolate praline box' }).locator('.badge').first()),
});
await kit.caption('');

await kit.finish(mp4, { system: 'Wix', repo: 'Wix-Supertext-Translation', gif });
await browser.close();
rmSync(workDir, { recursive: true, force: true });
console.log(`Saved ${mp4} and ${gif} (${(statSync(gif).size / 1e6).toFixed(2)} MB)`);
process.exit(0);
