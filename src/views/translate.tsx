import type { ErrorInfo } from '../i18n/error.js';
import type { Job } from '../store/store.js';
import type { EntityPage, SiteLanguages } from '../translation/site.js';
import { localeName, schemaGroup, schemaName } from '../translation/site.js';
import type { Schema } from '../wix/client.js';
import { JobPanel } from './job.js';
import { ApiKeyHelp, appUrl, Layout, Notice, splitTemplate, type PageContext } from './layout.js';
import { targetCodeOf } from '../translation/language-codes.js';

export interface TranslatePageProps {
  ctx: PageContext;
  hasKey: boolean;
  languageCodes: Record<string, string>;
  languages?: SiteLanguages;
  schemas: Schema[];
  schema?: Schema;
  entities?: EntityPage;
  cursor?: string;
  job?: Job;
  error?: ErrorInfo;
}

export function TranslatePage(props: TranslatePageProps) {
  const { ctx, languages, schema, entities } = props;
  const { t } = ctx;
  const heading = t.t('translate.heading');

  return (
    <Layout ctx={ctx} title={heading}>
      <h1>{heading}</h1>
      <p class="intro">{t.t('translate.intro')}</p>

      {!props.hasKey && <NoKey ctx={ctx} />}
      {props.error && <Notice tone="error">{t.error(props.error)}</Notice>}

      {languages && languages.targets.length === 0 && (
        <Notice tone="info">
          <strong>{t.t('translate.oneLanguage.heading')}</strong>
          <p>{t.t('translate.oneLanguage.text')}</p>
        </Notice>
      )}
      {languages && languages.targets.length > 0 && props.schemas.length === 0 && (
        <Notice tone="info">{t.t('translate.noSchemas')}</Notice>
      )}

      {languages && languages.targets.length > 0 && schema && entities && (
        <form id="translate-form" class="card" data-schema={schema.id}>
          <h2>{t.t('translate.step1')}</h2>
          <label class="field">
            <span>{t.t('translate.type')}</span>
            <select id="schema-select" name="type">
              {groups(props.schemas, t.t('translate.otherApps')).map(([group, schemas]) => (
                <optgroup label={group}>
                  {schemas.map((candidate) => (
                    <option value={appUrl(ctx, '/', { type: candidate.id })} selected={candidate.id === schema.id}>
                      {schemaName(candidate)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {entities.rows.length === 0 ? (
            <p class="muted">{t.t('translate.empty')}</p>
          ) : (
            <>
              <table class="items">
                <thead>
                  <tr>
                    <th class="check">
                      <input
                        type="checkbox"
                        id="select-all"
                        aria-label={t.t('translate.selectAll', { count: entities.rows.length })}
                      />
                    </th>
                    <th>{t.t('translate.item')}</th>
                    {languages.targets.map((locale) => (
                      <th>{localeName(locale)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entities.rows.map((row) => (
                    <tr>
                      <td class="check">
                        <input type="checkbox" name="entity" value={row.entityId} aria-label={row.title} />
                      </td>
                      <td class="title">{row.title}</td>
                      {languages.targets.map((locale) => {
                        const state = row.states[locale.id] ?? 'none';
                        return (
                          <td>
                            <span class={`badge ${state}`}>{t.t(`state.${state}`)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div class="pager">
                <label class="inline">
                  <input type="checkbox" id="select-all-text" />
                  {t.t('translate.selectAll', { count: entities.rows.length })}
                </label>
                <span class="spacer"></span>
                {props.cursor && <a href={appUrl(ctx, '/', { type: schema.id })}>{t.t('translate.firstPage')}</a>}
                {entities.nextCursor && (
                  <a href={appUrl(ctx, '/', { type: schema.id, cursor: entities.nextCursor })}>
                    {t.t('translate.nextPage')}
                  </a>
                )}
              </div>
            </>
          )}

          <h2>{t.t('translate.step2')}</h2>
          <p class="muted">{t.t('translate.from', { language: localeName(languages.primary) })}</p>
          <div class="languages">
            {languages.targets.map((locale) => {
              // No Supertext language: unchecked; if chosen anyway, the job says where to map it.
              const code = targetCodeOf(locale.id, props.languageCodes);
              const [before, after] = splitTemplate(t.t('translate.noLanguage'), ['{settings}']);
              return (
                <label class="language">
                  <input type="checkbox" name="locale" value={locale.id} checked={code !== null} />
                  <span>{localeName(locale)}</span>
                  {code !== null ? (
                    <code>{code}</code>
                  ) : (
                    <span class="warning-text">
                      ({before}
                      <a href={appUrl(ctx, '/settings')}>{t.t('translate.noLanguage.settings')}</a>
                      {after})
                    </span>
                  )}
                  {locale.visibility === 'HIDDEN' && <span class="muted">({t.t('translate.hidden')})</span>}
                </label>
              );
            })}
          </div>

          <label class="inline overwrite">
            <input type="checkbox" id="overwrite" name="overwrite" />
            {t.t('translate.overwrite')}
          </label>
          <p class="help" id="overwrite-hint">
            {t.t('translate.overwriteHint')}
          </p>
          <div id="overwrite-warning" class="notice warning" hidden>
            {t.t('translate.overwriteWarning')}
          </div>

          <div class="actions">
            <button
              type="submit"
              class="primary"
              id="translate-button"
              disabled={!props.hasKey}
              data-label={t.t('translate.submit')}
              data-label-one={t.t('translate.submitCount.one')}
              data-label-other={t.t('translate.submitCount.other')}
              data-starting={t.t('translate.starting')}
              data-select={t.t('translate.selectSomething')}
            >
              {t.t('translate.submit')}
            </button>
            <span id="form-message" class="muted" role="status"></span>
          </div>
        </form>
      )}

      {languages && languages.targets.length > 0 && schema && entities && entities.rows.length > 0 && (
        <ExportCard ctx={ctx} schema={schema} languages={languages} languageCodes={props.languageCodes} />
      )}
      {languages && languages.targets.length > 0 && <ImportCard ctx={ctx} />}

      <section id="job-panel" data-job={props.job?.status === 'running' ? props.job.id : undefined}>
        {props.job && <JobPanel t={t} job={props.job} languages={languages} />}
      </section>
    </Layout>
  );
}

function NoKey(props: { ctx: PageContext }) {
  const { ctx } = props;
  const { t } = ctx;
  const [before, after] = splitTemplate(t.t('translate.noKey.text'), ['{settings}']);
  return (
    <Notice tone="warning">
      <strong>{t.t('translate.noKey.heading')}</strong>
      <p>
        {before}
        <a href={appUrl(ctx, '/settings')}>{t.t('translate.noKey.settings')}</a>
        {after}
      </p>
      <ApiKeyHelp t={t} />
    </Notice>
  );
}

/** Schemas grouped by app (Wix Stores, Wix Blog …), others last. */
function groups(schemas: Schema[], other: string): [string, Schema[]][] {
  const map = new Map<string, Schema[]>();
  for (const schema of schemas) {
    const group = schemaGroup(schema) || other;
    map.set(group, [...(map.get(group) ?? []), schema]);
  }
  // Keeps the order of translatableSchemas: Wix Stores first, others last.
  return [...map.entries()];
}

/** "Export for translation": the item ticked in the list above, as XLIFF or HTML (public/app.js downloads it). */
function ExportCard(props: { ctx: PageContext; schema: Schema; languages: SiteLanguages; languageCodes: Record<string, string> }) {
  const { t } = props.ctx;
  return (
    <section id="export-card" class="card" data-schema={props.schema.id} data-select-one={t.t('files.export.selectOne')}>
      <h2>{t.t('files.export.heading')}</h2>
      <p class="muted">{t.t('files.export.text')}</p>
      <fieldset class="plain">
        <legend>{t.t('files.format')}</legend>
        <label class="inline">
          <input type="radio" name="file-format" value="xliff" checked />
          {t.t('files.format.xliff')}
        </label>
        <label class="inline">
          <input type="radio" name="file-format" value="html" />
          {t.t('files.format.html')}
        </label>
      </fieldset>
      <fieldset class="plain">
        <legend>{t.t('files.languages')}</legend>
        <div class="languages">
          {props.languages.targets.map((locale) => (
            <label class="language">
              <input type="checkbox" name="export-locale" value={locale.id} checked />
              <span>{localeName(locale)}</span>
              {/* Unmapped languages don't block an export: the file names the Wix code. */}
              <code>{targetCodeOf(locale.id, props.languageCodes) ?? locale.id.replace(/_/g, '-')}</code>
            </label>
          ))}
        </div>
      </fieldset>
      <div class="actions">
        <button type="button" class="primary" id="export-button">
          {t.t('files.download')}
        </button>
        <span id="export-message" class="muted" role="status"></span>
      </div>
    </section>
  );
}

/** "Import translation": upload a translated file; the summary comes back as HTML. */
function ImportCard(props: { ctx: PageContext }) {
  const { t } = props.ctx;
  return (
    <form id="import-form" class="card" enctype="multipart/form-data" data-too-large={t.t('error.file_too_large')} data-importing={t.t('files.importing')}>
      <h2>{t.t('files.import.heading')}</h2>
      <p class="muted">{t.t('files.import.text')}</p>
      <label class="field">
        <span>{t.t('files.file')}</span>
        <input type="file" name="file" accept=".xlf,.xliff,.html,.htm" required />
      </label>
      <label class="inline">
        <input type="checkbox" name="includeChanged" value="1" />
        {t.t('files.includeChanged')}
      </label>
      <label class="inline">
        <input type="checkbox" name="overwrite" value="1" />
        {t.t('translate.overwrite')}
      </label>
      <div class="actions">
        <button type="submit" class="primary" id="import-button">
          {t.t('files.import.submit')}
        </button>
        <span id="import-message" class="muted" role="status"></span>
      </div>
      <div id="import-result"></div>
    </form>
  );
}
