import type { Child } from 'hono/jsx';
import type { MessageKey, Translator } from '../i18n/index.js';
import type { ApiKeyCheck } from '../supertext/index.js';

/** What every page needs: the language, the signed instance to pass on, and the current page. */
export interface PageContext {
  t: Translator;
  /** The signed Wix instance, passed on in links, forms and API calls. */
  instance: string;
  page: 'translate' | 'settings';
}

export const SIGNUP_URL = 'https://www.supertext.com/person/en/account/signin';
export const API_KEY_URL = 'https://www.supertext.com/en/integrations/api';

/** A link within the app, keeping the instance and language. */
export function appUrl(ctx: PageContext, path: string, params: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams({ instance: ctx.instance, locale: ctx.t.locale });
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  return `${path}?${query}`;
}

export function Layout(props: { ctx: PageContext; title: string; children: Child }) {
  const { ctx } = props;
  const { t } = ctx;
  return (
    <html lang={t.locale}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <link rel="preload" href="/static/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin="" />
        <link rel="stylesheet" href="/static/app.css" />
        <link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#003230" />
      </head>
      <body data-instance={ctx.instance} data-locale={t.locale}>
        <header class="topbar">
          <div class="brand">
            <img src="/static/supertext-logo.svg" alt="Supertext" width="100" height="18" />
          </div>
          <nav class="tabs">
            <a href={appUrl(ctx, '/')} class={ctx.page === 'translate' ? 'tab active' : 'tab'}>
              {t.t('nav.translate')}
            </a>
            <a href={appUrl(ctx, '/settings')} class={ctx.page === 'settings' ? 'tab active' : 'tab'}>
              {t.t('nav.settings')}
            </a>
          </nav>
        </header>
        <main class="page">{props.children}</main>
        <script src="/static/app.js" defer></script>
      </body>
    </html>
  );
}

/** "No Supertext account yet? Create one at supertext.com. Generate your API key at …" with links. */
export function ApiKeyHelp(props: { t: Translator }) {
  const { t } = props;
  const [before, middle, after] = splitTemplate(t.t('apiKeyHelp.text'), ['{signup}', '{apiKey}']);
  return (
    <p class="help">
      {before}
      <a href={SIGNUP_URL} target="_blank" rel="noopener">
        {t.t('apiKeyHelp.signup')}
      </a>
      {middle}
      <a href={API_KEY_URL} target="_blank" rel="noopener">
        {t.t('apiKeyHelp.apiKey')}
      </a>
      {after}
    </p>
  );
}

/** Splits "a {x} b {y} c" at the given placeholders, in order. */
export function splitTemplate(text: string, placeholders: string[]): string[] {
  const parts: string[] = [];
  let rest = text;
  for (const placeholder of placeholders) {
    const index = rest.indexOf(placeholder);
    if (index < 0) {
      parts.push(rest);
      rest = '';
      continue;
    }
    parts.push(rest.slice(0, index));
    rest = rest.slice(index + placeholder.length);
  }
  parts.push(rest);
  return parts;
}

export function Notice(props: { tone: 'info' | 'success' | 'warning' | 'error'; children: Child }) {
  return <div class={`notice ${props.tone}`}>{props.children}</div>;
}

/**
 * The result of the automatic API key check (Commando Center protocol wording), with
 * supertext.com and supertext.com → Integrations → API linked (new tab).
 */
export function KeyCheckMessage(props: { t: Translator; check: ApiKeyCheck; withTime?: boolean }) {
  const { t, check } = props;
  const key = `keyCheck.${check.status}` as MessageKey;
  const text = t.t(key in KEY_CHECK_STATUSES ? key : 'keyCheck.error', { status: check.httpStatus ?? check.errorCode ?? '?' });
  const parts = text.split(/(\{signup\}|\{apiKey\})/);
  const tone = check.status === 'ok' ? 'success' : check.status === 'invalid' || check.status === 'missing' ? 'error' : 'warning';
  return (
    <div class={`notice ${tone} key-check`} data-status={check.status}>
      <p>
        {parts.map((part) =>
          part === '{signup}' ? (
            <a href={SIGNUP_URL} target="_blank" rel="noopener">
              {t.t('keyCheck.signup')}
            </a>
          ) : part === '{apiKey}' ? (
            <a href={API_KEY_URL} target="_blank" rel="noopener">
              {t.t('apiKeyHelp.apiKey')}
            </a>
          ) : (
            part
          ),
        )}
      </p>
      {props.withTime && <p class="muted">{t.t('keyCheck.checkedAt', { time: formatTime(check.checkedAt, t.locale) })}</p>}
    </div>
  );
}

const KEY_CHECK_STATUSES: Record<string, true> = {
  'keyCheck.ok': true,
  'keyCheck.invalid': true,
  'keyCheck.missing': true,
  'keyCheck.unreachable': true,
  'keyCheck.error': true,
};

/** "14 Oct 2026, 08:15 UTC" in the interface language. */
export function formatTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)} UTC`;
}
