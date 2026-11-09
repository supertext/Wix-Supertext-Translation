import { describe, expect, it } from 'vitest';
import { signInstance } from '../src/auth/instance.js';
import type { Job } from '../src/store/store.js';
import { loadConfig } from '../src/config.js';
import { effectiveReviewUrl, REVIEW_URL } from '../src/supertext/index.js';
import { APP_SECRET, INSTANCE_ID, setup } from './helpers.js';
import { CATEGORIES, PRODUCTS } from './standin/seed.js';

const startJob = async (env: ReturnType<typeof setup>, body: Record<string, unknown>) => {
  const response = await env.request('/api/jobs', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  return { status: response.status, json: (await response.json()) as { id?: string; error?: { code?: string } } };
};

const content = (env: ReturnType<typeof setup>, entityId: string, locale: string) =>
  env.wix.contents.find((candidate) => candidate.entityId === entityId && candidate.locale === locale);

describe('translate page', () => {
  it('lists the content types, items and their state per language', async () => {
    const env = setup();
    const response = await env.page('/', { type: CATEGORIES });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Translate with Supertext');
    expect(html).toMatch(/<optgroup label="Wix Stores">.*Products.*Categories.*<optgroup label="Wix Blog">/s);
    expect(html).toContain('Swiss chocolate');
    expect(html).toContain('Partly translated');
    expect(html).toContain('Translating from English');
    expect(html).toContain('German (Switzerland)');
    expect(html).toContain('<code>de-CH</code>');
    expect(html).toContain('hidden on the site');
  });

  it('follows the dashboard language', async () => {
    const env = setup();
    const html = await (await env.page('/', { locale: 'de' })).text();
    expect(html).toContain('Mit Supertext übersetzen');
    expect(html).toContain('Nicht übersetzt');
  });

  it('turns away requests that Wix did not sign', async () => {
    const env = setup();
    const forged = signInstance({ instanceId: INSTANCE_ID, uid: 'u' }, 'not-the-secret');
    expect((await env.app.request(`/?instance=${forged}`)).status).toBe(401);
    expect((await env.app.request('/api/jobs', { method: 'POST', headers: { 'X-Wix-Instance': forged } })).status).toBe(401);
  });

  it('asks for an API key when there is none', async () => {
    const env = setup({ SUPERTEXT_API_KEY: '' });
    const html = await (await env.page('/')).text();
    expect(html).toContain('Add your Supertext API key');
    expect(html).toContain('https://www.supertext.com/person/en/account/signin');
    expect(html).toContain('https://www.supertext.com/en/integrations/api');
    const { status, json } = await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-praline-box'], locales: ['de-CH'] });
    expect(status).toBe(400);
    expect(json.error?.code).toBe('missing_api_key');
  });
});

describe('translation job', () => {
  it('translates the selected items into the selected languages and writes them to Wix Multilingual', async () => {
    const env = setup();
    const { json } = await startJob(env, {
      schemaId: PRODUCTS,
      entityIds: ['prod-praline-box', 'prod-hazelnut-bar'],
      locales: ['de-CH', 'fr-CH'],
    });
    await env.settle();
    const job = (await env.store.getJob(INSTANCE_ID, json.id!)) as Job;
    expect(job.status).toBe('done');
    expect(job.items.map((item) => [item.entityId, item.locale, item.state, item.written])).toEqual([
      ['prod-praline-box', 'de-CH', 'translated', 4],
      ['prod-praline-box', 'fr-CH', 'translated', 4],
      ['prod-hazelnut-bar', 'de-CH', 'translated', 2],
      ['prod-hazelnut-bar', 'fr-CH', 'translated', 2],
    ]);

    const de = content(env, 'prod-praline-box', 'de-CH')!;
    expect(de.fields.name).toEqual({ textValue: 'Pralinenbox mit dunkler Schokolade', published: true, updatedBy: 'EXTERNAL_APP' });
    expect(de.fields['choice(small)'].textValue).toBe('Schachtel mit 12 Stück');
    expect(de.fields.mainImage).toBeUndefined();
    const paragraph = de.fields.description.richContent!.nodes[1].nodes!;
    expect(paragraph.map((node) => node.textData!.text).join('')).toBe(
      'Zwölf handgemachte Pralinen mit 70 % dunkler Schokolade aus Bern. Mehr über unsere Chocolatiers.',
    );
    expect(paragraph.find((node) => node.textData!.text === 'unsere Chocolatiers')!.textData!.decorations![0].type).toBe('LINK');
    expect(de.fields.description.richContent!.nodes[2].nodes![1].nodes![0].nodes![0].textData!.text).toBe(
      'Ohne Palmöl, ohne Konservierungsstoffe',
    );
    expect(content(env, 'prod-hazelnut-bar', 'fr-CH')!.fields.name.textValue).toBe('Tablette de chocolat au lait aux noisettes');

    // One document per item and language, source as the bare language, target with region.
    expect(env.supertext.documents).toHaveLength(4);
    expect(env.supertext.documents[0]).toMatchObject({ target: 'de-CH', source: 'en' });
    // Access tokens are reused (at most one token request).
    expect(env.wix.log.filter((line) => line.endsWith('/oauth2/token')).length).toBeLessThanOrEqual(1);

    // The page shows the result.
    const panel = (await (await env.request(`/api/jobs/${json.id}?locale=en`)).json()) as { status: string; html: string };
    expect(panel.status).toBe('done');
    expect(panel.html).toContain('Done: 4 translated, 0 unchanged, 0 failed.');
    expect(panel.html).toContain('Translated (4 fields)');
  });

  it('keeps existing translations unless asked to overwrite', async () => {
    const env = setup();
    const first = await startJob(env, { schemaId: CATEGORIES, entityIds: ['cat-swiss-chocolate'], locales: ['de-CH'] });
    await env.settle();
    const job = (await env.store.getJob(INSTANCE_ID, first.json.id!))!;
    expect(job.items[0]).toMatchObject({ state: 'translated', written: 1, kept: 1 });
    expect(content(env, 'cat-swiss-chocolate', 'de-CH')!.fields.description.textValue).toContain('<strong>Bern</strong>');

    content(env, 'cat-swiss-chocolate', 'de-CH')!.fields.name.textValue = 'Von Hand geändert';
    await startJob(env, { schemaId: CATEGORIES, entityIds: ['cat-swiss-chocolate'], locales: ['de-CH'] });
    await env.settle();
    expect((await env.store.latestJob(INSTANCE_ID))!.items[0]).toMatchObject({ state: 'unchanged', kept: 2 });
    expect(content(env, 'cat-swiss-chocolate', 'de-CH')!.fields.name.textValue).toBe('Von Hand geändert');

    await startJob(env, { schemaId: CATEGORIES, entityIds: ['cat-swiss-chocolate'], locales: ['de-CH'], overwrite: true });
    await env.settle();
    expect(content(env, 'cat-swiss-chocolate', 'de-CH')!.fields.name.textValue).toBe('Schweizer Schokolade');
  });

  it('uses the site settings: tone, language codes, publishing', async () => {
    const env = setup();
    const settings = await env.store.getSettings(INSTANCE_ID);
    await env.store.saveSettings({ ...settings, tone: 'more', publish: false, languageCodes: { 'fr-CH': 'fr-FR' } });
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-hazelnut-bar'], locales: ['fr-CH'] });
    await env.settle();
    expect(env.supertext.documents[0]).toMatchObject({ target: 'fr-FR', politeness: 'more' });
    expect(content(env, 'prod-hazelnut-bar', 'fr-CH')!.fields.name.published).toBe(false);
  });

  it('skips a language Supertext rejects and stops on authentication errors', async () => {
    const env = setup();
    const settings = await env.store.getSettings(INSTANCE_ID);
    // A code Supertext doesn't know (the SDK sends unknown bare languages unchanged).
    await env.store.saveSettings({ ...settings, languageCodes: { 'de-CH': 'xx' } });
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-praline-box', 'prod-hazelnut-bar'], locales: ['de-CH', 'fr-CH'] });
    await env.settle();
    const job = (await env.store.latestJob(INSTANCE_ID))!;
    expect(job.status).toBe('done');
    expect(job.items.filter((item) => item.locale === 'de-CH').map((item) => item.error?.code)).toEqual(['invalid_language_pair', 'invalid_language_pair']);
    expect(job.items.filter((item) => item.locale === 'fr-CH').every((item) => item.state === 'translated')).toBe(true);
    const panel = (await (await env.request(`/api/jobs/${job.id}?locale=en`)).json()) as { html: string };
    expect(panel.html).toContain('Supertext doesn&#39;t translate from &quot;en&quot; into &quot;xx&quot;. Choose another Supertext language for it under Settings → Languages.');
    expect(env.supertext.documents.map((document) => document.target)).toEqual(['fr-CH', 'fr-CH']);

    await env.store.saveSettings({ ...settings, apiKey: 'invalid' });
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-praline-box', 'prod-hazelnut-bar'], locales: ['de-CH', 'fr-CH'] });
    await env.settle();
    const failed = (await env.store.latestJob(INSTANCE_ID))!;
    expect(failed.status).toBe('failed');
    expect(failed.error?.code).toBe('authentication_failure');
    expect(failed.items).toHaveLength(1);
  });

  it('sends nothing for a site language without a Supertext language and says where to map it', async () => {
    const env = setup();
    env.wix.locales.push({ id: 'gsw', languageCode: 'gsw', displayName: 'Swiss German' });
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-hazelnut-bar'], locales: ['gsw', 'fr-CH'] });
    await env.settle();
    const job = (await env.store.latestJob(INSTANCE_ID))!;
    expect(job.status).toBe('done');
    expect(job.items.map((item) => [item.locale, item.state, item.error?.code])).toEqual([
      ['fr-CH', 'translated', undefined],
      ['gsw', 'failed', 'unsupported_language'],
    ]);
    expect(env.supertext.documents.map((document) => document.target)).toEqual(['fr-CH']);
    for (const locale of ['en', 'de', 'fr', 'it']) {
      const panel = (await (await env.request(`/api/jobs/${job.id}?locale=${locale}`)).json()) as { html: string };
      expect(panel.html).toContain('Swiss German');
    }
    const panel = (await (await env.request(`/api/jobs/${job.id}?locale=en`)).json()) as { html: string };
    expect(panel.html).toContain('&quot;Swiss German&quot; has no Supertext language yet, so nothing was sent. Choose its Supertext language under Settings → Languages.');

    // Mapped, it is translated.
    const settings = await env.store.getSettings(INSTANCE_ID);
    await env.store.saveSettings({ ...settings, languageCodes: { gsw: 'gsw-u-sd-chbe' } });
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-hazelnut-bar'], locales: ['gsw'] });
    await env.settle();
    expect(env.supertext.documents.at(-1)?.target).toBe('gsw-u-sd-chbe');
  });

  it('translates an unmapped language with an obvious default (de → de-DE)', async () => {
    const env = setup();
    env.wix.locales.push({ id: 'de', languageCode: 'de', displayName: 'German' });
    const translate = await (await env.page('/')).text();
    expect(translate).toMatch(/<input type="checkbox" name="locale" value="de" checked=""\/>/);
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-hazelnut-bar'], locales: ['de'] });
    await env.settle();
    expect(env.supertext.documents.at(-1)?.target).toBe('de-DE');
    expect((await env.store.latestJob(INSTANCE_ID))!.items.every((item) => item.state === 'translated')).toBe(true);
  });

  it('sends politeness only to targets that offer it', async () => {
    const env = setup();
    env.wix.locales.push({ id: 'en-GB', languageCode: 'en', regionCode: 'GB', displayName: 'English (UK)' });
    const settings = await env.store.getSettings(INSTANCE_ID);
    await env.store.saveSettings({ ...settings, tone: 'more' });
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-hazelnut-bar'], locales: ['en-GB', 'de-CH'] });
    await env.settle();
    expect(env.supertext.documents.map((document) => [document.target, document.politeness])).toEqual([
      ['de-CH', 'more'],
      ['en-GB', undefined],
    ]);
    expect((await env.store.latestJob(INSTANCE_ID))!.items.every((item) => item.state === 'translated')).toBe(true);
  });

  it('tells the Commando Center once when Supertext rejects the key during a translation', async () => {
    const env = setup();
    await env.page('/');
    await env.settle();
    expect(env.supertext.reports.map((report) => report.event)).toEqual(['installed']);
    const settings = await env.store.getSettings(INSTANCE_ID);
    await env.store.saveSettings({ ...settings, apiKey: 'invalid' });
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-hazelnut-bar'], locales: ['de-CH'] });
    await env.settle();
    expect(env.supertext.reports.at(-1)).toMatchObject({ event: 'api_key_check', api_key_check: { status: 'invalid', http_status: 401 } });
  });

  it('reports an unknown regional target (HTTP 404) as an unsupported language pair', async () => {
    const env = setup();
    const settings = await env.store.getSettings(INSTANCE_ID);
    await env.store.saveSettings({ ...settings, languageCodes: { 'de-CH': 'xx-XX' } });
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-hazelnut-bar'], locales: ['de-CH'] });
    await env.settle();
    const job = (await env.store.latestJob(INSTANCE_ID))!;
    expect(job.items.map((item) => item.error?.code)).toEqual(['invalid_language_pair']);
  });
});

describe('translation review', () => {
  const byHost = (env: ReturnType<typeof setup>, host: string) =>
    env.supertextCalls.filter((call) => call.host === host && call.path.startsWith('/v1/translate/')).map((call) => call.method);

  it('sends a language with Translation review through the review service, the others directly', async () => {
    const env = setup();
    const settings = await env.store.getSettings(INSTANCE_ID);
    await env.store.saveSettings({ ...settings, reviewLocales: ['de-CH'] });
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-hazelnut-bar'], locales: ['de-CH', 'fr-CH'] });
    await env.settle();
    const job = (await env.store.latestJob(INSTANCE_ID))!;
    expect(job.items.map((item) => [item.locale, item.state])).toEqual([
      ['de-CH', 'translated'],
      ['fr-CH', 'translated'],
    ]);
    // German: upload, status, download and delete through the review service; French directly.
    expect(byHost(env, 'review.test')).toEqual(['POST', 'GET', 'GET', 'DELETE']);
    expect(byHost(env, 'supertext.test')).toEqual(['POST', 'GET', 'GET', 'DELETE']);
    expect(content(env, 'prod-hazelnut-bar', 'de-CH')!.fields.name.textValue).toBe('Milchschokoladentafel mit Haselnüssen');
  });

  it("is off everywhere with an empty SUPERTEXT_REVIEW_URL, and Supertext's review service by default", async () => {
    const env = setup({ SUPERTEXT_REVIEW_URL: '' });
    const settings = await env.store.getSettings(INSTANCE_ID);
    await env.store.saveSettings({ ...settings, reviewLocales: ['de-CH'] });
    await startJob(env, { schemaId: PRODUCTS, entityIds: ['prod-hazelnut-bar'], locales: ['de-CH'] });
    await env.settle();
    expect(byHost(env, 'review.test')).toEqual([]);
    expect(byHost(env, 'supertext.test')).toEqual(['POST', 'GET', 'GET', 'DELETE']);
    const html = await (await env.page('/settings')).text();
    expect(html).toMatch(/<input type="checkbox" name="review:de-CH" value="1" checked="" disabled=""/);
    expect(html).toContain('Translation review is turned off on this server');

    expect(loadConfig({}).reviewUrl).toBe(REVIEW_URL);
    expect(REVIEW_URL).toBe('https://localizationreview-production.up.railway.app/v1/');
    expect(effectiveReviewUrl(REVIEW_URL, '')).toBe(REVIEW_URL);
    expect(effectiveReviewUrl('', '')).toBe('');
    expect(effectiveReviewUrl('https://api.supertext.com/v1', '')).toBe('');
    expect(effectiveReviewUrl('https://supertext.test/v1/', 'https://supertext.test/v1')).toBe('');
  });

  it('never uses the review service for the API key check', async () => {
    const env = setup();
    const settings = await env.store.getSettings(INSTANCE_ID);
    await env.store.saveSettings({ ...settings, reviewLocales: ['de-CH', 'fr-CH'] });
    await env.request('/api/test', { method: 'POST', body: JSON.stringify({ apiKey: 'some-key' }) });
    await env.settle();
    expect(env.supertextCalls.filter((call) => call.host === 'review.test')).toEqual([]);
  });

  it('saves the checkbox per target language on Settings → Languages', async () => {
    const env = setup();
    const response = await env.app.request('/settings', {
      method: 'POST',
      body: new URLSearchParams({ instance: env.instance, locale: 'de', tone: 'default', 'review:fr-CH': '1', 'target:fr-CH': 'fr-CH' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect((await env.store.getSettings(INSTANCE_ID)).reviewLocales).toEqual(['fr-CH']);
    const html = await (await env.app.request(response.headers.get('location')!)).text();
    expect(html).toContain('<th>Übersetzungsprüfung</th>');
    expect(html).toMatch(/<input type="checkbox" name="review:fr-CH" value="1" checked=""/);
    expect(html).toMatch(/<input type="checkbox" name="review:de-CH" value="1"(?! checked)/);
    expect(html).not.toContain('name="review:en-US"');
    await env.settle();
  });
});

describe('settings', () => {
  it('saves the key, tone, publishing and language mapping, and reports codes Supertext does not offer', async () => {
    const env = setup();
    const form = new URLSearchParams({
      instance: env.instance,
      locale: 'fr',
      apiKey: 'Supertext-Auth-Key my-key',
      tone: 'less',
      'source:en-US': '',
      'target:de-CH': 'de-de',
      'target:fr-CH': 'french',
      versionReports: '1',
    });
    const response = await env.app.request('/settings', { method: 'POST', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('invalid=french');
    expect(response.headers.get('location')).toContain('locale=fr');
    const saved = await env.store.getSettings(INSTANCE_ID);
    expect(saved).toMatchObject({
      apiKey: 'Supertext-Auth-Key my-key',
      tone: 'less',
      publish: false,
      languageCodes: { 'de-CH': 'de-DE' },
      versionReports: true,
    });

    const html = await (await env.app.request(response.headers.get('location')!)).text();
    expect(html).toContain('Paramètres Supertext');
    expect(html).toContain('french');
    expect(html).toContain('Une clé est enregistrée');
    expect(html).toMatch(/version <a href="https:\/\/github.com\/Supertext\/Wix-Supertext-Translation\/releases\/tag\/v\d+\.\d+\.\d+"/);
    // The mapping: a combo box per language, the saved code, else the suggestion preselected.
    expect(html).toMatch(/<select id="target-de-CH" name="target:de-CH">.*<option value="de-DE" selected="">/s);
    expect(html).toMatch(/<select id="target-fr-CH" name="target:fr-CH">.*<option value="fr-CH" selected="">/s);
    expect(html).toMatch(/<select id="source-en-US" name="source:en-US">.*<option value="en" selected="">/s);
    expect(html).toContain('Envoyer les informations de version à Supertext');
    await env.settle();
  });

  it('marks site languages without a Supertext language and only offers politeness where Supertext has it', async () => {
    const env = setup();
    env.wix.locales.push(
      { id: 'de', languageCode: 'de', displayName: 'German' },
      { id: 'en-IE', languageCode: 'en', regionCode: 'IE', displayName: 'English (Ireland)' },
      { id: 'en-GB', languageCode: 'en', regionCode: 'GB', displayName: 'English (UK)' },
    );
    const settings = await env.store.getSettings(INSTANCE_ID);
    await env.store.saveSettings({ ...settings, tone: 'more' });
    const html = await (await env.page('/settings')).text();
    expect(html).toContain('These languages have no Supertext language yet and aren&#39;t translated until you choose one: English (Ireland).');
    // German has a default: preselected, not flagged.
    expect(html).toMatch(/<select id="target-de" name="target:de">.*<option value="de-DE" selected="">/s);
    expect(html).toContain('— Not translated: choose a Supertext language —');
    expect(html).toContain('Formal or informal address isn&#39;t available for English (UK); Supertext decides there.');
    const translate = await (await env.page('/')).text();
    expect(translate).toMatch(/<input type="checkbox" name="locale" value="en-IE"\/>/);
    expect(translate).toMatch(/<input type="checkbox" name="locale" value="de" checked=""\/>/);
    expect(translate).toContain('no Supertext language yet');
    await env.settle();
  });

  it('runs the API key check when the settings are saved and shows it with the links', async () => {
    const env = setup({ SUPERTEXT_API_KEY: '' });
    const post = (fields: Record<string, string>) =>
      env.app.request('/settings', {
        method: 'POST',
        body: new URLSearchParams({ instance: env.instance, locale: 'en', tone: 'default', versionReports: '1', ...fields }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    const missing = await post({});
    let html = await (await env.app.request(missing.headers.get('location')!)).text();
    expect(html).toContain('No API key is set yet.');
    expect(html).toContain('<a href="https://www.supertext.com/person/en/account/signin" target="_blank" rel="noopener">supertext.com</a>');
    expect(html).toContain('<a href="https://www.supertext.com/en/integrations/api" target="_blank" rel="noopener">supertext.com → Integrations → API</a>');

    await post({ apiKey: 'invalid' });
    html = await (await env.page('/settings')).text();
    expect(html).toContain('Supertext rejected the API key.');
    expect(html).toMatch(/Last API key check: .*UTC/);

    await post({ apiKey: 'good-key' });
    html = await (await env.page('/settings', { locale: 'de' })).text();
    expect(html).toContain('API-Schlüssel geprüft: Die Verbindung zu Supertext funktioniert.');
    await env.settle();

    // installed (missing key), then settings_saved twice; the key itself is never sent.
    expect(env.supertext.reports.map((report) => [report.event, report.api_key_check?.status])).toEqual([
      ['installed', 'missing'],
      ['settings_saved', 'invalid'],
      ['settings_saved', 'ok'],
    ]);
    expect(JSON.stringify(env.supertext.reports)).not.toContain('good-key');
  });

  it('tests the connection with the entered or saved key', async () => {
    const env = setup();
    const ok = (await (await env.request('/api/test?locale=de', { method: 'POST', body: JSON.stringify({ apiKey: '' }) })).json()) as {
      ok: boolean;
      html: string;
    };
    expect(ok.ok).toBe(true);
    expect(ok.html).toContain('API-Schlüssel geprüft: Die Verbindung zu Supertext funktioniert.');
    const bad = (await (await env.request('/api/test', { method: 'POST', body: JSON.stringify({ apiKey: 'invalid' }) })).json()) as {
      ok: boolean;
      status: string;
      html: string;
    };
    expect(bad).toMatchObject({ ok: false, status: 'invalid' });
    expect(bad.html).toContain('Supertext rejected the API key.');
    expect(bad.html).toContain('target="_blank" rel="noopener"');
    // The saved key's check is stored; a typed key's isn't.
    expect((await env.reporting.lastCheck(INSTANCE_ID))?.status).toBe('ok');
    await env.settle();
  });

  it('stores API keys encrypted', async () => {
    const { Secrets } = await import('../src/store/store.js');
    const secrets = new Secrets(APP_SECRET);
    const sealed = secrets.encrypt('my-key');
    expect(sealed).not.toContain('my-key');
    expect(secrets.decrypt(sealed)).toBe('my-key');
    expect(new Secrets('other').decrypt(sealed)).toBe('');
  });
});

describe('health and framing', () => {
  it('answers the health check and allows framing by the Wix dashboard', async () => {
    const env = setup();
    const response = await env.app.request('/health');
    expect(await response.text()).toBe('ok');
    expect(response.headers.get('content-security-policy')).toContain('https://manage.wix.com');
  });
});
