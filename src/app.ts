import { createVerify } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { verifyInstance, type AppInstance } from './auth/instance.js';
import type { Config } from './config.js';
import { errorInfo, LocalizedError, type ErrorInfo } from './i18n/error.js';
import { resolveLocale, translator, type Translator } from './i18n/index.js';
import { Reporting } from './reporting.js';
import { createSupertextClient, effectiveReviewUrl, type ApiKeyCheck } from './supertext/index.js';
import type { SiteSettings, Store } from './store/store.js';
import { exportFile, importFile, refuseLargeUpload } from './translation/files.js';
import { startJob } from './translation/jobs.js';
import { supportedSource, supportedTarget } from './translation/language-codes.js';
import { entityPage, siteLanguages, translatableSchemas, type SiteLanguages } from './translation/site.js';
import { ImportSummaryPanel } from './views/files.js';
import { JobPanel } from './views/job.js';
import { appUrl, KeyCheckMessage, type PageContext } from './views/layout.js';
import { SettingsPage } from './views/settings.js';
import { TranslatePage } from './views/translate.js';
import { WixClient } from './wix/client.js';

export interface AppDeps {
  config: Config;
  store: Store;
  /** Injected for tests. */
  fetch?: typeof fetch;
  /** Called with each job's completion promise (tests wait on it). */
  onJob?: (done: Promise<unknown>) => void;
  /** Version reports and the API key check (Commando Center); built from the config if not given. */
  reporting?: Reporting;
}

/** Wix shows dashboard pages in an iframe on these hosts. */
const FRAME_ANCESTORS = "frame-ancestors 'self' https://manage.wix.com https://*.wix.com https://*.wixstudio.com";

export function createApp(deps: AppDeps) {
  const { config, store } = deps;
  const app = new Hono();

  const wixFor = (instanceId: string) =>
    new WixClient({
      appId: config.wixAppId,
      appSecret: config.wixAppSecret,
      instanceId,
      apiBase: config.wixApiBase,
      fetch: deps.fetch,
    });
  /** '' = Translation review is off on this server (SUPERTEXT_REVIEW_URL=''). */
  const reviewUrl = effectiveReviewUrl(config.reviewUrl, config.supertextEndpoint);
  /**
   * Translations: directly to Supertext, or, for a language with *Translation review* on, through
   * the review service (same key, User-Agent and fetch). The key check, version reports and
   * translation files never use the review service.
   */
  const supertextFor = (settings: SiteSettings, review = false) =>
    createSupertextClient({
      apiKey: settings.apiKey || config.supertextApiKey,
      endpoint: review && reviewUrl ? reviewUrl : config.supertextEndpoint,
      fetch: deps.fetch,
    });
  const hasKey = (settings: SiteSettings) => Boolean(settings.apiKey || config.supertextApiKey);
  const reporting =
    deps.reporting ??
    new Reporting({
      config,
      store,
      siteInfo: (instanceId) => wixFor(instanceId).siteInfo(),
      fetch: deps.fetch,
      log: (message) => console.log(message),
    });

  app.use('*', async (c, next) => {
    await next();
    c.header('Content-Security-Policy', FRAME_ANCESTORS);
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('X-Content-Type-Options', 'nosniff');
  });

  app.get('/health', (c) => c.text('ok'));

  /** The signed instance of a page request (query or form), or a "reload" page. */
  const pageAuth = (c: Context, signed: string | undefined): { instance: AppInstance; signed: string } | Response => {
    try {
      return { instance: verifyInstance(signed, config.wixAppSecret), signed: signed! };
    } catch (error) {
      console.warn('Supertext: rejected dashboard request:', (error as Error).message);
      const t = translator(resolveLocale(c.req.query('locale'), c.req.header('accept-language')));
      return c.html(`<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif">${t.t('error.session')}</p>`, 401);
    }
  };

  /** API calls carry the signed instance in a header. */
  const apiAuth = (c: Context): AppInstance | Response => {
    try {
      return verifyInstance(c.req.header('x-wix-instance'), config.wixAppSecret);
    } catch {
      return c.json({ error: { message: 'Invalid instance', code: 'session' } satisfies ErrorInfo }, 401);
    }
  };

  const localeOf = (c: Context, value?: string): Translator =>
    translator(resolveLocale(value ?? c.req.query('locale'), c.req.header('accept-language')));

  app.get('/', async (c) => {
    const auth = pageAuth(c, c.req.query('instance'));
    if (auth instanceof Response) return auth;
    const t = localeOf(c);
    console.log(`Supertext: translate page opened on instance ${auth.instance.instanceId}`);
    const ctx: PageContext = { t, instance: auth.signed, page: 'translate' };
    const settings = await store.getSettings(auth.instance.instanceId);
    reporting.inBackground(auth.instance.instanceId, 'onRequest');
    const wix = wixFor(auth.instance.instanceId);
    let languages: SiteLanguages | undefined;
    let schemas: Awaited<ReturnType<typeof translatableSchemas>> = [];
    let error: ErrorInfo | undefined;
    let entities;
    const cursor = c.req.query('cursor') || undefined;
    const requested = c.req.query('type');
    let schema;
    try {
      languages = await siteLanguages(wix);
      schemas = translatableSchemas(await wix.schemas());
      schema = schemas.find((candidate) => candidate.id === requested) ?? schemas[0];
      if (schema && languages.targets.length > 0) {
        entities = await entityPage(wix, schema, languages, cursor);
      }
    } catch (caught) {
      console.error('Supertext: could not load the translate page', caught);
      error = errorInfo(caught);
    }
    const job = await store.latestJob(auth.instance.instanceId);
    return c.html(
      page(TranslatePage({
        ctx,
        hasKey: hasKey(settings),
        languageCodes: settings.languageCodes,
        languages,
        schemas,
        schema,
        entities,
        cursor,
        job,
        error,
      })),
    );
  });

  app.post('/api/jobs', async (c) => {
    const instance = apiAuth(c);
    if (instance instanceof Response) return instance;
    const body = (await c.req.json().catch(() => ({}))) as {
      schemaId?: string;
      entityIds?: string[];
      locales?: string[];
      overwrite?: boolean;
    };
    const entityIds = (body.entityIds ?? []).filter((id) => typeof id === 'string' && id.length > 0);
    const locales = (body.locales ?? []).filter((id) => typeof id === 'string' && id.length > 0);
    if (!body.schemaId || entityIds.length === 0 || locales.length === 0) {
      return c.json({ error: { message: 'Select at least one item and one language.', code: 'select' } }, 400);
    }
    const settings = await store.getSettings(instance.instanceId);
    if (!hasKey(settings)) {
      return c.json({ error: errorInfo(new LocalizedError('No Supertext API key configured.', 'missing_api_key')) }, 400);
    }
    reporting.inBackground(instance.instanceId, 'onRequest');
    const { job, done } = await startJob(
      {
        store,
        wix: wixFor(instance.instanceId),
        supertext: supertextFor,
        onAuthenticationFailure: (status) => reporting.inBackground(instance.instanceId, 'authenticationFailed', status),
      },
      { instanceId: instance.instanceId, schemaId: body.schemaId, entityIds, locales, overwrite: Boolean(body.overwrite) },
    );
    deps.onJob?.(done);
    return c.json({ id: job.id });
  });

  app.get('/api/jobs/:id', async (c) => {
    const instance = apiAuth(c);
    if (instance instanceof Response) return instance;
    const job = await store.getJob(instance.instanceId, c.req.param('id'));
    if (!job) return c.json({ error: { message: 'Not found', code: 'notFound' } }, 404);
    const t = localeOf(c);
    let languages: SiteLanguages | undefined;
    try {
      languages = await siteLanguages(wixFor(instance.instanceId));
    } catch {
      // names fall back to locale IDs
    }
    const html = (await JobPanel({ t, job, languages })).toString();
    return c.json({ status: job.status, html });
  });

  /** *Export for translation*: one item, XLIFF (one or more languages) or HTML (one) → the file as a download. */
  app.post('/api/files/export', async (c) => {
    const instance = apiAuth(c);
    if (instance instanceof Response) return instance;
    const t = localeOf(c);
    const body = (await c.req.json().catch(() => ({}))) as { schemaId?: string; entityIds?: string[]; locales?: string[]; format?: string };
    try {
      const entityIds = (body.entityIds ?? []).filter((id) => typeof id === 'string' && id.length > 0);
      if (!body.schemaId || entityIds.length !== 1) {
        throw new LocalizedError('Select exactly one item to export.', 'file_select_one');
      }
      const settings = await store.getSettings(instance.instanceId);
      const file = await exportFile(wixFor(instance.instanceId), {
        schemaId: body.schemaId,
        entityId: entityIds[0],
        locales: (body.locales ?? []).filter((id) => typeof id === 'string'),
        format: body.format === 'html' ? 'html' : 'xliff',
        mapping: settings.languageCodes,
      });
      return c.body(file.content, 200, {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.filename.replace(/[^\w.-]/g, '_')}"`,
        'Cache-Control': 'no-store',
      });
    } catch (error) {
      const info = errorInfo(error);
      return c.json({ error: info, text: t.error(info) }, 400);
    }
  });

  /** *Import translation*: one uploaded file (≤ 10 MB, parsed in memory, never stored) → written, summary HTML. */
  app.post('/api/files/import', async (c) => {
    const instance = apiAuth(c);
    if (instance instanceof Response) return instance;
    const t = localeOf(c);
    try {
      refuseLargeUpload(c.req.header('content-length'));
      const form = await c.req.parseBody();
      const file = form.file;
      if (!(file instanceof File) || file.size === 0) throw new LocalizedError('Choose a file.', 'file_choose');
      refuseLargeUpload(undefined, file);
      const settings = await store.getSettings(instance.instanceId);
      const summaries = await importFile(wixFor(instance.instanceId), await file.text(), {
        includeChanged: form.includeChanged === '1',
        overwrite: form.overwrite === '1',
        publish: settings.publish,
      });
      const html = (await ImportSummaryPanel({ t, summaries }).toString()).toString();
      return c.json({ summaries, html });
    } catch (error) {
      const info = errorInfo(error);
      return c.json({ error: info, text: t.error(info) }, 400);
    }
  });

  /** *Test connection*: the key typed into the field, else the saved key (then also the stored key check). */
  app.post('/api/test', async (c) => {
    const instance = apiAuth(c);
    if (instance instanceof Response) return instance;
    const t = localeOf(c);
    const body = (await c.req.json().catch(() => ({}))) as { apiKey?: string };
    const settings = await store.getSettings(instance.instanceId);
    const typed = body.apiKey?.trim() ?? '';
    let check: ApiKeyCheck | null = null;
    if (!typed) check = (await reporting.run(instance.instanceId, 'testConnection'))?.check ?? null;
    if (!check) {
      check = await createSupertextClient({
        apiKey: typed || reporting.apiKey(settings),
        endpoint: config.supertextEndpoint,
        fetch: deps.fetch,
      }).checkApiKey();
    }
    const html = (await KeyCheckMessage({ t, check }).toString()).toString();
    return c.json({ ok: check.status === 'ok', status: check.status, html });
  });

  app.get('/settings', async (c) => {
    const auth = pageAuth(c, c.req.query('instance'));
    if (auth instanceof Response) return auth;
    const t = localeOf(c);
    const settings = await store.getSettings(auth.instance.instanceId);
    reporting.inBackground(auth.instance.instanceId, 'onRequest');
    const keyCheck = await reporting.lastCheck(auth.instance.instanceId);
    let languages: SiteLanguages | undefined;
    let languagesError: ErrorInfo | undefined;
    try {
      languages = await siteLanguages(wixFor(auth.instance.instanceId));
    } catch (error) {
      languagesError = errorInfo(error);
    }
    return c.html(
      page(SettingsPage({
        ctx: { t, instance: auth.signed, page: 'settings' },
        settings,
        serverKey: Boolean(config.supertextApiKey),
        reviewAvailable: Boolean(reviewUrl),
        languages,
        languagesError,
        keyCheck,
        reports: { enabled: reporting.enabled(settings), forced: reporting.forcedByServer },
        saved: c.req.query('saved') === '1',
        invalidCodes: c.req.query('invalid') || undefined,
      })),
    );
  });

  app.post('/settings', async (c) => {
    const form = await c.req.parseBody();
    const signed = String(form.instance ?? '');
    const auth = pageAuth(c, signed);
    if (auth instanceof Response) return auth;
    const t = localeOf(c, String(form.locale ?? ''));
    const settings = await store.getSettings(auth.instance.instanceId);
    const apiKey = String(form.apiKey ?? '').trim();
    if (form.removeKey === '1') settings.apiKey = '';
    if (apiKey) settings.apiKey = apiKey;
    const tone = String(form.tone ?? 'default');
    settings.tone = tone === 'more' || tone === 'less' ? tone : 'default';
    settings.publish = form.publish === '1';
    // The checkbox is disabled (not sent) while SUPERTEXT_VERSION_REPORTS decides for all sites.
    if (!reporting.forcedByServer) settings.versionReports = form.versionReports === '1';
    // Language mapping: `target:<locale>` for the site's other languages, `source:<locale>` for its main one.
    // Only codes Supertext offers are stored (in their exact form); empty = the locale's own code, if Supertext has it.
    const invalid: string[] = [];
    const codes: Record<string, string> = {};
    for (const [name, value] of Object.entries(form)) {
      const field = /^(target|source):(.+)$/.exec(name);
      if (!field) continue;
      const code = String(value).trim();
      if (!code) continue;
      const supported = field[1] === 'source' ? supportedSource(code) : supportedTarget(code);
      if (supported) codes[field[2]] = supported;
      else invalid.push(code);
    }
    settings.languageCodes = codes;
    // *Translation review* per target language (`review:<locale>`). While the server has review off,
    // the checkboxes are disabled (not sent): keep the saved choice.
    if (reviewUrl) {
      settings.reviewLocales = Object.keys(form)
        .map((name) => /^review:(.+)$/.exec(name)?.[1])
        .filter((locale): locale is string => Boolean(locale) && form[`review:${locale}`] === '1');
    }
    await store.saveSettings(settings);
    // The automatic API key check and the settings_saved report; never fails the save.
    await reporting.run(auth.instance.instanceId, 'afterSettingsSaved');
    const ctx: PageContext = { t, instance: signed, page: 'settings' };
    return c.redirect(appUrl(ctx, '/settings', { saved: '1', invalid: invalid.join(', ') || undefined }), 303);
  });

  /** Wix webhooks: forget a site's settings when the app is removed. */
  app.post('/webhooks', async (c) => {
    const body = await c.req.text();
    if (!config.wixPublicKey) return c.text('ignored');
    const event = verifyWebhook(body, config.wixPublicKey);
    if (!event) return c.text('invalid', 401);
    if (event.eventType === 'AppRemoved' && event.instanceId) {
      await store.deleteSite(event.instanceId);
      console.log(`Supertext: app removed from instance ${event.instanceId}; settings deleted.`);
    }
    return c.text('ok');
  });

  return app;
}

/** A full HTML page from a JSX element. */
async function page(element: { toString(): string | Promise<string> }): Promise<string> {
  return `<!doctype html>\n${await element.toString()}`;
}

/** Wix sends webhooks as an RS256 JWT; its `data` claim is JSON with eventType and instanceId. */
export function verifyWebhook(jwt: string, publicKey: string): { eventType?: string; instanceId?: string } | undefined {
  const [header, payload, signature] = jwt.trim().split('.');
  if (!header || !payload || !signature) return undefined;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${header}.${payload}`);
  if (!verifier.verify(publicKey, Buffer.from(signature, 'base64url'))) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { data?: string };
    const outer = JSON.parse(claims.data ?? '{}') as { eventType?: string; instanceId?: string };
    return { eventType: outer.eventType, instanceId: outer.instanceId };
  } catch {
    return undefined;
  }
}
