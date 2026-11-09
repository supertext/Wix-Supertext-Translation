import type { Translator } from '../i18n/index.js';
import type { ImportSummary } from '../translation/files.js';

/** The summary after "Import translation": one block per item and language of the file. */
export function ImportSummaryPanel(props: { t: Translator; summaries: ImportSummary[] }) {
  const { t } = props;
  return (
    <div class="import-summary">
      {props.summaries.map((summary) => {
        const lines = summary.error
          ? []
          : [
              t.t('files.summary.ok', { count: summary.written }),
              summary.skippedChanged ? t.t('files.summary.changed', { count: summary.skippedChanged }) : '',
              summary.counts.untranslated ? t.t('files.summary.untranslated', { count: summary.counts.untranslated }) : '',
              summary.counts.invalid_markup ? t.t('files.summary.invalid', { count: summary.counts.invalid_markup }) : '',
              summary.counts.missing ? t.t('files.summary.missing', { count: summary.counts.missing }) : '',
              summary.kept ? t.t('files.summary.kept', { count: summary.kept }) : '',
              summary.notWritten ? t.t('files.summary.notWritten', { count: summary.notWritten }) : '',
            ].filter(Boolean);
        return (
          <div class={`notice ${summary.error ? 'error' : summary.written > 0 ? 'success' : 'info'}`}>
            <strong>
              {summary.title ?? summary.reference}
              {summary.language ? ` · ${summary.language}` : ''}
            </strong>
            {summary.error ? (
              <p>{t.error(summary.error)}</p>
            ) : (
              <ul>
                {lines.map((line) => (
                  <li>{line}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
