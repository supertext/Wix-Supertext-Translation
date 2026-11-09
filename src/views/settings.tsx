import type { ErrorInfo } from '../i18n/error.js';
import type { SiteSettings } from '../store/store.js';
import type { ApiKeyCheck } from '../supertext/index.js';
import {
  languageName,
  SOURCE_LANGUAGES,
  sourceCodeOf,
  suggestSource,
  suggestTarget,
  supportsPoliteness,
  targetCodeOf,
  targetOptions,
} from '../translation/language-codes.js';
import { localeName, type SiteLanguages } from '../translation/site.js';
import { releaseUrl, VERSION } from '../version.js';
import { ApiKeyHelp, KeyCheckMessage, Layout, Notice, splitTemplate, type PageContext } from './layout.js';

export interface SettingsPageProps {
  ctx: PageContext;
  settings: SiteSettings;
  /** A key is set on the server (SUPERTEXT_API_KEY). */
  serverKey: boolean;
  /** Translation review is available (SUPERTEXT_REVIEW_URL isn't ''). */
  reviewAvailable?: boolean;
  languages?: SiteLanguages;
  languagesError?: ErrorInfo;
  /** The latest automatic API key check (after a save, *Test connection*, a rejected translation). */
  keyCheck?: ApiKeyCheck | null;
  /** "Send version information to Supertext": effective value, and whether the server decides. */
  reports: { enabled: boolean; forced: boolean };
  saved?: boolean;
  invalidCodes?: string;
}

export function SettingsPage(props: SettingsPageProps) {
  const { ctx, settings, languages } = props;
  const { t } = ctx;
  const heading = t.t('settings.heading');
  const [versionBefore, versionAfter] = splitTemplate(t.t('settings.about.version'), ['{version}']);
  const mapping = settings.languageCodes;
  const unmapped = languages ? languages.targets.filter((locale) => targetCodeOf(locale.id, mapping) === null) : [];
  const noPoliteness =
    languages && settings.tone !== 'default'
      ? languages.targets.filter((locale) => {
          const code = targetCodeOf(locale.id, mapping);
          return code !== null && !supportsPoliteness(code);
        })
      : [];
  const sourceMissing = languages ? sourceCodeOf(languages.primary.id, mapping) === null : false;

  return (
    <Layout ctx={ctx} title={heading}>
      <h1>{heading}</h1>
      {props.saved && !props.invalidCodes && <Notice tone="success">{t.t('settings.saved')}</Notice>}
      {props.invalidCodes && (
        <Notice tone="warning">{t.t('settings.invalidCodes', { codes: props.invalidCodes })}</Notice>
      )}

      <form method="post" action="/settings" class="settings">
        <input type="hidden" name="instance" value={ctx.instance} />
        <input type="hidden" name="locale" value={t.locale} />

        <section class="card">
          <h2>{t.t('settings.apiKey.heading')}</h2>
          <label class="field">
            <span>{t.t('settings.apiKey.label')}</span>
            <input
              type="password"
              name="apiKey"
              autocomplete="off"
              placeholder={settings.apiKey ? t.t('settings.apiKey.placeholderSaved') : t.t('settings.apiKey.placeholder')}
            />
          </label>
          <ApiKeyHelp t={t} />
          {!settings.apiKey && props.serverKey && <p class="muted">{t.t('settings.apiKey.server')}</p>}
          {settings.apiKey && (
            <label class="inline">
              <input type="checkbox" name="removeKey" value="1" />
              {t.t('settings.apiKey.remove')}
            </label>
          )}
          {props.keyCheck && <KeyCheckMessage t={t} check={props.keyCheck} withTime />}
          <div class="actions">
            <button type="button" id="test-button" data-testing={t.t('settings.testing')}>
              {t.t('settings.test')}
            </button>
          </div>
          <div id="test-result" role="status"></div>
        </section>

        <section class="card">
          <h2>{t.t('settings.style.heading')}</h2>
          <label class="field">
            <span>{t.t('settings.style.label')}</span>
            <select name="tone">
              {(['default', 'more', 'less'] as const).map((tone) => (
                <option value={tone} selected={settings.tone === tone}>
                  {t.t(`settings.style.${tone}`)}
                </option>
              ))}
            </select>
          </label>
          <label class="inline">
            <input type="checkbox" name="publish" value="1" checked={settings.publish} />
            {t.t('settings.publish')}
          </label>
          <p class="help">{t.t('settings.publishHint')}</p>
          {noPoliteness.length > 0 && (
            <p class="help">{t.t('settings.style.noPoliteness', { languages: noPoliteness.map(localeName).join(', ') })}</p>
          )}
        </section>

        <section class="card">
          <h2>{t.t('settings.languages.heading')}</h2>
          <p class="help">{t.t('settings.languages.text')}</p>
          {props.languagesError && <Notice tone="error">{t.error(props.languagesError)}</Notice>}
          {languages && (unmapped.length > 0 || sourceMissing) && (
            <Notice tone="warning">
              {t.t('settings.languages.unmapped', {
                languages: [...(sourceMissing ? [languages.primary] : []), ...unmapped].map(localeName).join(', '),
              })}
            </Notice>
          )}
          {languages && (
            <table class="codes">
              <thead>
                <tr>
                  <th>{t.t('settings.languages.site')}</th>
                  <th>{t.t('settings.languages.supertext')}</th>
                  <th>{t.t('settings.languages.review')}</th>
                </tr>
              </thead>
              <tbody>
                <LanguageRow
                  ctx={ctx}
                  name={`${localeName(languages.primary)} (${t.t('settings.languages.main')})`}
                  field={`source:${languages.primary.id}`}
                  value={mapping[languages.primary.id] ?? ''}
                  suggested={suggestSource(languages.primary.id)}
                  options={SOURCE_LANGUAGES.map((language) => language.code)}
                />
                {languages.targets.map((locale) => (
                  <LanguageRow
                    ctx={ctx}
                    name={localeName(locale)}
                    field={`target:${locale.id}`}
                    value={mapping[locale.id] ?? ''}
                    suggested={suggestTarget(locale.id)}
                    options={targetOptions()}
                    review={{
                      field: `review:${locale.id}`,
                      checked: (settings.reviewLocales ?? []).includes(locale.id),
                      disabled: props.reviewAvailable === false,
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
          {languages && languages.targets.length > 0 && (
            <>
              <p class="help">{t.t('settings.languages.reviewHelp')}</p>
              {props.reviewAvailable === false && <p class="muted">{t.t('settings.languages.reviewOff')}</p>}
            </>
          )}
        </section>

        <section class="card">
          <h2>{t.t('settings.reports.heading')}</h2>
          <label class="inline">
            <input
              type="checkbox"
              name="versionReports"
              value="1"
              checked={props.reports.enabled}
              disabled={props.reports.forced}
            />
            {t.t('settings.reports.label')}
          </label>
          <p class="help">{t.t('settings.reports.help')}</p>
          {props.reports.forced && (
            <p class="muted">{t.t(props.reports.enabled ? 'settings.reports.forcedOn' : 'settings.reports.forcedOff')}</p>
          )}
        </section>

        <div class="actions">
          <button type="submit" class="primary">
            {t.t('settings.save')}
          </button>
        </div>
      </form>

      <section class="card about">
        <h2>{t.t('settings.about.heading')}</h2>
        <p>
          {versionBefore}
          <a href={releaseUrl()} target="_blank" rel="noopener">
            {VERSION || '?'}
          </a>
          {versionAfter}
        </p>
      </section>
    </Layout>
  );
}

/**
 * One site language and its Supertext language: a combo box with Supertext's codes, the saved
 * code selected, else the suggestion (the exact code, else the SDK default: de → de-DE), else
 * "— choose —" (not translated until a code is chosen).
 */
function LanguageRow(props: {
  ctx: PageContext;
  name: string;
  field: string;
  value: string;
  suggested: string | null;
  options: string[];
  /** The *Translation review* checkbox (target languages only). */
  review?: { field: string; checked: boolean; disabled: boolean };
}) {
  const { t } = props.ctx;
  const id = props.field.replace(/[^\w-]/g, '-');
  const selected = props.value || props.suggested || '';
  const options = props.options
    .map((code) => ({ code, name: languageName(code, t.locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, t.locale));
  return (
    <tr>
      <td>
        <label for={id}>{props.name}</label>
        {!selected && (
          <>
            {' '}
            <span class="badge none">{t.t('settings.languages.missing')}</span>
          </>
        )}
      </td>
      <td>
        <select id={id} name={props.field}>
          {!selected && (
            <option value="" selected>
              {t.t('settings.languages.choose')}
            </option>
          )}
          {options.map((option) => (
            <option value={option.code} selected={selected === option.code}>
              {option.name} ({option.code})
            </option>
          ))}
          {props.value && !props.options.includes(props.value) && (
            <option value={props.value} selected>
              {props.value}
            </option>
          )}
        </select>
      </td>
      <td class="review">
        {props.review && (
          <input
            type="checkbox"
            name={props.review.field}
            value="1"
            checked={props.review.checked}
            disabled={props.review.disabled}
            aria-label={`${t.t('settings.languages.review')}: ${props.name}`}
          />
        )}
      </td>
    </tr>
  );
}
