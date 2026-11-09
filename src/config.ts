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
  /** Default Supertext API key for sites that haven't entered their own (the demo site). */
  supertextApiKey: string;
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
    supertextEndpoint: env.SUPERTEXT_API_ENDPOINT ?? '',
    reviewUrl: (env.SUPERTEXT_REVIEW_URL ?? REVIEW_URL).trim(),
    databaseUrl: env.DATABASE_URL ?? '',
    encryptionKey: env.APP_ENCRYPTION_KEY ?? '',
    versionReports: env.SUPERTEXT_VERSION_REPORTS ?? '',
    reportUrl: env.SUPERTEXT_REPORT_URL ?? '',
  };
}
