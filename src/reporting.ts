/**
 * Version reports to the Supertext Commando Center and the automatic API key check
 * (Commando-Center-Supertext-Translation → docs/DEVELOPER.md → Report protocol).
 * The protocol is Supertext Plugin Health's (`InstallationReporter`, bundled in
 * src/vendor/supertext-plugin-health); the key check is the Supertext SDK's
 * (`checkApiKey()`). This file only gives them what the app knows about each site
 * and keeps the reporter's state per site instance (`Store.getReporterState` /
 * `saveReporterState`, the `reporter_state` column).
 *
 * A hosted app: one installation per Wix site, so one state per instance ID.
 * No ping endpoint and no callback URL. The site URL is the site's published URL
 * from Wix (`GET /apps/v1/instance` → `site.url`), else the site's dashboard
 * address `https://manage.wix.com/dashboard/<siteId>` (unpublished sites); if Wix
 * can't be asked, the key is still checked but nothing is reported.
 *
 * Nothing here ever throws into a request or a translation; the API key is never
 * logged or sent (only its check result).
 */
import type { Config } from './config.js';
import { apiKeyFingerprint, createSupertextClient, SDK_VERSION, type ApiKeyCheck } from './supertext/index.js';
import {
  InstallationReporter,
  reporterState,
  reportsEnabled,
  type FetchLike,
  type KeyChecker,
  type LanguageMapping,
  type ReporterOptions,
  type ReporterResult,
} from './vendor/supertext-plugin-health/index.js';
import type { SiteSettings, Store } from './store/store.js';
import { VERSION } from './version.js';
import type { SiteInfo } from './wix/client.js';

/** The GitHub repository name: the center reads the latest release from it. */
export const PLUGIN_NAME = 'Wix-Supertext-Translation';
export const SYSTEM_NAME = 'Wix';

export type ReportAction = 'afterSettingsSaved' | 'onRequest' | 'authenticationFailed' | 'testConnection';

/** The site URL for the reports: the published URL, else the site's dashboard address, else null. */
export function siteUrlOf(info: SiteInfo | undefined): string | null {
  const url = info?.url?.trim();
  if (url && /^https?:\/\//i.test(url)) return url;
  if (info?.siteId && /^[\w-]+$/.test(info.siteId)) return `https://manage.wix.com/dashboard/${info.siteId}`;
  return null;
}

export interface ReportingDeps {
  config: Pick<Config, 'supertextApiKey' | 'supertextEndpoint' | 'versionReports' | 'reportUrl'>;
  store: Pick<Store, 'getSettings' | 'getReporterState' | 'saveReporterState'>;
  /** The site's details from Wix (published URL, site ID). */
  siteInfo: (instanceId: string) => Promise<SiteInfo>;
  /** HTTP for the key check and the report (tests); the global fetch by default. */
  fetch?: typeof fetch;
  /** Tests: options for the Plugin Health reporter (clock …). */
  reporterOverrides?: Partial<ReporterOptions>;
  log?: (message: string) => void;
}

/**
 * A reporter result with the key check typed as the SDK's (the checks come from the SDK's
 * `checkApiKey()` or are `invalid` after a 401/403, so the status is one of the SDK's).
 */
export type ReportResult = Omit<ReporterResult, 'check'> & { check: ApiKeyCheck | null };

/** Site URLs are looked up at most every 6 hours per site. */
const SITE_URL_TTL_MS = 6 * 3600_000;

export class Reporting {
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly siteUrls = new Map<string, { url: string; at: number }>();
  /** Background tasks still running (tests wait for them). */
  readonly pending = new Set<Promise<unknown>>();

  constructor(private readonly deps: ReportingDeps) {}

  /** Whether the server's SUPERTEXT_VERSION_REPORTS decides for all sites. */
  get forcedByServer(): boolean {
    return /^(0|false|off|no|1|true|on|yes)$/i.test(this.deps.config.versionReports.trim());
  }

  /** "Send version information to Supertext" for a site, after SUPERTEXT_VERSION_REPORTS. */
  enabled(settings: Pick<SiteSettings, 'versionReports'>): boolean {
    return reportsEnabled(settings.versionReports, this.deps.config.versionReports);
  }

  /** The API key reports and checks are about: the site's own, else the server's. */
  apiKey(settings: Pick<SiteSettings, 'apiKey'>): string {
    return settings.apiKey || this.deps.config.supertextApiKey;
  }

  /** The latest stored key check of a site (settings page). */
  async lastCheck(instanceId: string): Promise<ApiKeyCheck | null> {
    try {
      return reporterState(await this.deps.store.getReporterState(instanceId)).keyCheck as ApiKeyCheck | null;
    } catch {
      return null;
    }
  }

  /**
   * Runs one reporter action for a site with its stored settings and state, and stores the
   * result. Calls per site are serialized, so two requests don't report twice, and each reads
   * the settings when it runs (a background task never acts on a key that was replaced since).
   * Never throws.
   */
  run(instanceId: string, action: ReportAction, httpStatus?: number): Promise<ReportResult | null> {
    const previous = this.queues.get(instanceId) ?? Promise.resolve();
    const task = previous.then(async () => {
      try {
        const settings = await this.deps.store.getSettings(instanceId);
        const siteUrl = await this.siteUrl(instanceId);
        const reporter = this.reporter(siteUrl, settings);
        const state = reporterState(await this.deps.store.getReporterState(instanceId));
        const key = this.apiKey(settings);
        const result =
          action === 'afterSettingsSaved'
            ? await reporter.afterSettingsSaved(state, key)
            : action === 'testConnection'
              ? await reporter.testConnection(state, key)
              : action === 'authenticationFailed'
                ? await reporter.authenticationFailed(state, key, httpStatus ?? 401)
                : await reporter.onRequest(state, key);
        await this.deps.store.saveReporterState(instanceId, result.state);
        if (result.event) {
          this.deps.log?.(`Supertext: version report ${result.event} for instance ${instanceId}: ${result.sent ? 'sent' : 'not sent'}`);
        }
        return result as ReportResult;
      } catch (error) {
        this.deps.log?.(`Supertext: version report skipped: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    });
    this.queues.set(instanceId, task);
    void task.finally(() => {
      if (this.queues.get(instanceId) === task) this.queues.delete(instanceId);
    });
    return task;
  }

  /**
   * "Send configuration to Supertext" (Settings): the site's language mapping in one `extensions`
   * report (a hosted app has no plugins of its own to list, so the list is empty), sent now (also
   * within the hour after a failed report). Null while version reports are off or without a site
   * URL. Never throws.
   */
  sendConfiguration(instanceId: string, languages: LanguageMapping[]): Promise<ReportResult | null> {
    const previous = this.queues.get(instanceId) ?? Promise.resolve();
    const task = previous.then(async () => {
      try {
        const settings = await this.deps.store.getSettings(instanceId);
        const siteUrl = await this.siteUrl(instanceId);
        if (siteUrl === null || !this.enabled(settings)) return null;
        const state = reporterState(await this.deps.store.getReporterState(instanceId));
        const result = await this.reporter(siteUrl, settings, languages).sendExtensions(state, []);
        await this.deps.store.saveReporterState(instanceId, result.state);
        return result as ReportResult;
      } catch (error) {
        this.deps.log?.(`Supertext: configuration not sent: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    });
    this.queues.set(instanceId, task);
    void task.finally(() => {
      if (this.queues.get(instanceId) === task) this.queues.delete(instanceId);
    });
    return task;
  }

  /** For page views and API calls: starts after the current request and runs in the background. */
  inBackground(instanceId: string, action: ReportAction, httpStatus?: number): void {
    const task = new Promise<void>((resolve) => setImmediate(resolve)).then(() => this.run(instanceId, action, httpStatus));
    this.pending.add(task);
    void task.finally(() => this.pending.delete(task));
  }

  /** Waits for the background tasks (tests). */
  async settle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  private reporter(siteUrl: string | null, settings: SiteSettings, languages?: LanguageMapping[]): InstallationReporter {
    const { config } = this.deps;
    return new InstallationReporter({
      // Without a site URL the key is still checked, but nothing is reported.
      enabled: siteUrl !== null && this.enabled(settings),
      siteUrl: siteUrl ?? '',
      plugin: { name: PLUGIN_NAME, version: VERSION || '0.0.0' },
      system: { name: SYSTEM_NAME },
      sdkVersion: SDK_VERSION,
      callbackUrl: null, // hosted app: no ping endpoint
      keyChecker: this.keyChecker(),
      ...(languages ? { languages: () => languages } : {}),
      ...(config.reportUrl ? { reportUrl: config.reportUrl } : {}),
      ...(this.deps.fetch ? { fetch: this.deps.fetch as FetchLike } : {}),
      ...this.deps.reporterOverrides,
    });
  }

  /** The SDK's key check (`GET features`) with the app's client (endpoint, User-Agent). */
  private keyChecker(): KeyChecker {
    const { config } = this.deps;
    return {
      check: (apiKey) => createSupertextClient({ apiKey, endpoint: config.supertextEndpoint, fetch: this.deps.fetch }).checkApiKey(),
      fingerprint: apiKeyFingerprint,
    };
  }

  private async siteUrl(instanceId: string): Promise<string | null> {
    const cached = this.siteUrls.get(instanceId);
    if (cached && Date.now() - cached.at < SITE_URL_TTL_MS) return cached.url;
    try {
      const url = siteUrlOf(await this.deps.siteInfo(instanceId));
      if (url) this.siteUrls.set(instanceId, { url, at: Date.now() });
      return url ?? cached?.url ?? null;
    } catch {
      return cached?.url ?? null;
    }
  }
}
