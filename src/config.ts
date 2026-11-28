import { REVIEW_URL } from './supertext/index.js';

/** Settings from environment variables (Railway variables in production). */
export interface Config {
  port: number;
  /** Public HTTPS URL of this app (the dashboard page's iframe URL points here). */
  appUrl: string;
  wixAppId: string;
  wixAppSecret: string;
  /** Public key of the app (app dashboard → Webhooks), for verifying webhook JWTs. Optional. */
  wixPublicKey: string;
  /** Wix REST API base. Points at a stand-in in tests and for screenshots. */
  wixApiBase: string;
  /**
   * SUPERTEXT_API_KEY: a Supertext API key on the server, for ONE Wix site only (the demo site):
   * SUPERTEXT_API_KEY_INSTANCE, the app instance ID of that site. Without it the key is used for no
   * site. Every other site enters its own key. See serverApiKey().
   */
  supertextApiKey: string;
  supertextApiKeyInstance: string;
  supertextEndpoint: string;
  /**
   * SUPERTEXT_REVIEW_URL: the review service for languages with *Translation review* on.
   * Unset: Supertext's review service (REVIEW_URL); '' turns review off for every site and language.
   */
  reviewUrl: string;
  databaseUrl: string;
  /** Key for encrypting stored API keys; falls back to a key derived from the app secret. */
  encryptionKey: string;
  /** SUPERTEXT_VERSION_REPORTS as set ('' = each site's own setting; 0/false/off/no turns reports off for all sites). */
  versionReports: string;
  /** SUPERTEXT_REPORT_URL: the Commando Center's report URL (tests, stand-in); '' = the SDK's default (live center). */
  reportUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT) || 8080,
    appUrl: (env.APP_URL ?? '').replace(/\/+$/, ''),
    wixAppId: env.WIX_APP_ID ?? '',
    wixAppSecret: env.WIX_APP_SECRET ?? '',
    wixPublicKey: (env.WIX_PUBLIC_KEY ?? '').replace(/\\n/g, '\n'),
    wixApiBase: (env.WIX_API_BASE || 'https://www.wixapis.com').replace(/\/+$/, ''),
    supertextApiKey: env.SUPERTEXT_API_KEY ?? '',
    supertextApiKeyInstance: (env.SUPERTEXT_API_KEY_INSTANCE ?? '').trim(),
    supertextEndpoint: env.SUPERTEXT_API_ENDPOINT ?? '',
    reviewUrl: (env.SUPERTEXT_REVIEW_URL ?? REVIEW_URL).trim(),
    databaseUrl: env.DATABASE_URL ?? '',
    encryptionKey: env.APP_ENCRYPTION_KEY ?? '',
    versionReports: env.SUPERTEXT_VERSION_REPORTS ?? '',
    reportUrl: env.SUPERTEXT_REPORT_URL ?? '',
  };
}

/**
 * The server's Supertext API key for a site: SUPERTEXT_API_KEY, but only for the app instance
 * SUPERTEXT_API_KEY_INSTANCE names ('' for every other site, and when that is not set), so the key
 * on the server can't be used by whoever installs the app.
 */
export function serverApiKey(config: Pick<Config, 'supertextApiKey' | 'supertextApiKeyInstance'>, instanceId: string): string {
  if (!config.supertextApiKey || !config.supertextApiKeyInstance) return '';
  return config.supertextApiKeyInstance === instanceId ? config.supertextApiKey : '';
}
