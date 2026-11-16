import { useEffect, useState } from 'react';
import {
  ERROR_LOG_MAX_ENTRIES,
  clearErrors,
  getRecentErrors,
  type ErrorLogEntry,
} from '../errors/error-log';
import { isMessageKey } from '../i18n/message-keys';
import { t } from '../i18n/presentation';

function formatTime(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  try {
    return date.toLocaleString(chrome.i18n.getUILanguage());
  } catch {
    return date.toISOString();
  }
}

/** Shows the key as is when it is not in the list (not logged here, or the log would keep growing) */
function describe(entry: ErrorLogEntry): string {
  return isMessageKey(entry.messageKey) ? t(entry.messageKey) : entry.messageKey;
}

export type RecentErrorsProps = {
  /** Reloads whenever this value changes */
  refreshKey?: number;
};

/** List of recent errors and "Clear" (security-design.md §5, monitoring-design.md) */
export function RecentErrors({ refreshKey = 0 }: RecentErrorsProps) {
  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);
  const [hasClearFailed, setHasClearFailed] = useState(false);

  useEffect(() => {
    let isActive = true;
    void getRecentErrors().then((loaded) => {
      if (isActive) setEntries(loaded);
    });
    return () => {
      isActive = false;
    };
  }, [refreshKey]);

  const handleClear = async () => {
    const result = await clearErrors();
    setHasClearFailed(!result.ok);
    if (result.ok) setEntries([]);
  };

  return (
    <section className="panel" aria-labelledby="recent-errors-heading" data-testid="recent-errors">
      <h2 id="recent-errors-heading">{t('options.recentErrors')}</h2>
      <p className="note">{t('options.recentErrorsNote', { max: ERROR_LOG_MAX_ENTRIES })}</p>
      {entries.length === 0 ? (
        <p data-testid="recent-errors-empty">{t('options.recentErrorsEmpty')}</p>
      ) : (
        <ol className="recent-errors" data-testid="recent-errors-list">
          {entries.map((entry, index) => (
            <li key={`${entry.at}-${index}`} data-testid="recent-errors-item">
              <time dateTime={entry.at}>{formatTime(entry.at)}</time> <code>{entry.toolId}</code>{' '}
              <code>{entry.kind}</code> {describe(entry)}
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className="button"
        disabled={entries.length === 0}
        data-testid="recent-errors-clear"
        onClick={() => void handleClear()}
      >
        {t('options.clearErrors')}
      </button>
      {hasClearFailed ? (
        <p className="message message--error" role="alert" data-testid="recent-errors-clear-failed">
          {t('options.clearFailed')}
        </p>
      ) : null}
    </section>
  );
}
