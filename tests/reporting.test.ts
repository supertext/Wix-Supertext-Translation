import { describe, expect, it } from 'vitest';
import { PLUGIN_NAME, Reporting, siteUrlOf } from '../src/reporting.js';
import { MemoryStore } from '../src/store/store.js';
import { SDK_VERSION } from '../src/supertext/index.js';
import { createSupertextStandin } from './standin/supertext.js';
import { INSTANCE_ID, setup } from './helpers.js';

/** The glue alone: a fake transport (the stand-in) for the key check and the center. */
function reporting(options: { env?: string; siteInfo?: () => Promise<{ url?: string; siteId?: string }>; reportStatus?: number } = {}) {
  const supertext = createSupertextStandin();
  const store = new MemoryStore();
  let reportCalls = 0;
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.url === 'https://center.test/report') {
      reportCalls++;
      if (options.reportStatus) return new Response('{}', { status: options.reportStatus });
    }
    return supertext.handle(request);
  }) as typeof fetch;
  const r = new Reporting({
    config: {
      supertextApiKey: 'server-key',
      supertextApiKeyInstance: INSTANCE_ID,
      supertextEndpoint: 'https://supertext.test/v1/',
      versionReports: options.env ?? '',
      reportUrl: 'https://center.test/report',
    },
    store,
    fetch: fetchFn,
    siteInfo: options.siteInfo ?? (async () => ({ url: 'https://www.example.ch/', siteId: 'site-1' })),
  });
  return { r, store, supertext, calls: () => reportCalls };
}

describe('site URL', () => {
  it('is the published URL, else the site dashboard, else unknown', () => {
    expect(siteUrlOf({ url: 'https://www.example.ch/', siteId: 's' })).toBe('https://www.example.ch/');
    expect(siteUrlOf({ siteId: '9b2c4d6e-0000-4000-8000-00000000c0c0' })).toBe(
      'https://manage.wix.com/dashboard/9b2c4d6e-0000-4000-8000-00000000c0c0',
    );
    expect(siteUrlOf({ url: 'not a url' })).toBeNull();
    expect(siteUrlOf(undefined)).toBeNull();
  });
});

describe('reporting glue', () => {
  it('reports the app as a hosted Wix installation, without callback or key', async () => {
    const { r, supertext, calls } = reporting();
    const result = await r.run(INSTANCE_ID, 'afterSettingsSaved');
    expect(result).toMatchObject({ event: 'installed', sent: true, check: { status: 'ok' } });
    expect(calls()).toBe(1);
    expect(result!.state.reportedVersions).toMatch(/^\d+\.\d+\.\d+\|\|\d+/);
    expect(supertext.reports).toHaveLength(1); // the stand-in answered as the center
  });

  it('builds the report body with the plugin, system and site URL', async () => {
    const env = setup();
    await env.page('/settings');
    await env.settle();
    const [report] = env.supertext.reports;
    expect(report).toMatchObject({
      schema: 1,
      event: 'installed',
      site_url: 'https://www.chocolate-demo.example/',
      plugin: { name: PLUGIN_NAME },
      system: { name: 'Wix' },
      runtime: { name: 'Node.js' },
      api_key_configured: true,
      api_key_check: { status: 'ok', http_status: 200 },
      sdk_version: SDK_VERSION,
    });
    expect(report.plugin.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(report.callback).toBeUndefined();
    expect(JSON.stringify(report)).not.toContain('server-key');

    // Nothing new on the next request: no second report.
    await env.page('/');
    await env.settle();
    expect(env.supertext.reports).toHaveLength(1);
  });

  it('uses the site dashboard address for an unpublished site', async () => {
    const env = setup();
    env.wix.site.url = undefined;
    await env.page('/');
    await env.settle();
    expect(env.supertext.reports[0].site_url).toBe('https://manage.wix.com/dashboard/9b2c4d6e-0000-4000-8000-00000000c0c0');
  });

  it('sends nothing when the site or the server turns it off, but still checks the key', async () => {
    const off = setup();
    const settings = await off.store.getSettings(INSTANCE_ID);
    await off.store.saveSettings({ ...settings, versionReports: false });
    await off.page('/');
    await off.settle();
    expect(off.supertext.reports).toHaveLength(0);
    expect((await off.reporting.lastCheck(INSTANCE_ID))?.status).toBe('ok');

    const server = setup({ SUPERTEXT_VERSION_REPORTS: '0' });
    const html = await (await server.page('/settings')).text();
    expect(html).toMatch(/<input type="checkbox" name="versionReports" value="1" disabled=""\/>/);
    expect(html).toContain('Turned off for all sites');
    await server.settle();
    expect(server.supertext.reports).toHaveLength(0);
  });

  it('checks the key but reports nothing while Wix cannot say which site it is', async () => {
    const { r, calls } = reporting({ siteInfo: async () => Promise.reject(new Error('Wix down')) });
    const result = await r.run(INSTANCE_ID, 'afterSettingsSaved');
    expect(result).toMatchObject({ sent: false, check: { status: 'ok' } });
    expect(calls()).toBe(0);
  });

  it('waits an hour after a failed report and never throws', async () => {
    const { r, store, calls } = reporting({ reportStatus: 503 });
    expect(await r.run(INSTANCE_ID, 'afterSettingsSaved')).toMatchObject({ sent: false });
    await r.run(INSTANCE_ID, 'onRequest');
    expect(calls()).toBe(1);

    store.getReporterState = async () => {
      throw new Error('database down');
    };
    await expect(r.run(INSTANCE_ID, 'onRequest')).resolves.toBeNull();
  });

  it('Send configuration: the language mapping in one extensions report (no plugins), nothing when off', async () => {
    const languages = [
      { code: 'en', supertext: 'en' },
      { code: 'de', supertext: 'de-DE' },
      { code: 'en-ie', supertext: null },
    ];
    const { r, supertext } = reporting();
    expect(await r.sendConfiguration(INSTANCE_ID, languages)).toMatchObject({ event: 'extensions', sent: true });
    expect(supertext.reports).toHaveLength(1);
    expect(supertext.reports[0]).toMatchObject({ event: 'extensions', extensions: [], languages });
    expect(JSON.stringify(supertext.reports[0])).not.toContain('server-key');

    const off = reporting({ env: '0' });
    expect(await off.r.sendConfiguration(INSTANCE_ID, languages)).toBeNull();
    expect(off.supertext.reports).toHaveLength(0);
  });

  it('follows SUPERTEXT_VERSION_REPORTS over the site setting', () => {
    expect(reporting({ env: '0' }).r.enabled({ versionReports: true })).toBe(false);
    expect(reporting({ env: 'on' }).r.enabled({ versionReports: false })).toBe(true);
    expect(reporting().r.enabled({ versionReports: false })).toBe(false);
    expect(reporting().r.forcedByServer).toBe(false);
    expect(reporting({ env: 'off' }).r.forcedByServer).toBe(true);
  });
});
