/**
 * Counts and output buttons (BR2.5, BR2.6, BR3.8).
 * Output functions are called only from the buttons' onClick (NFR1.2; the handlers live in ChangeSetViewerApp).
 */
import { t } from '../../i18n/presentation';

/** Output result notice. null shows nothing */
export type ActionNoticeKind = 'copied' | 'saved' | 'copyFailed' | 'saveFailed' | null;

export type FooterProps = {
  shown: number;
  total: number;
  canExport: boolean;
  notice: ActionNoticeKind;
  onCopy: () => void;
  onCsv: () => void;
};

export function CountText({ shown, total }: { shown: number; total: number }) {
  return (
    <span className="viewer__count" data-testid="viewer-count">
      {t('viewer.count', { shown, total })}
    </span>
  );
}

const NOTICE_KEYS = {
  copied: 'viewer.copied',
  saved: 'viewer.saved',
  copyFailed: 'viewer.copyFailed',
  saveFailed: 'viewer.saveFailed',
} as const;

export function ActionNotice({ notice }: { notice: ActionNoticeKind }) {
  const isError = notice === 'copyFailed' || notice === 'saveFailed';
  return (
    <span
      className={`viewer__notice${isError ? ' viewer__notice--error' : ''}`}
      role="status"
      data-testid="viewer-action-notice"
    >
      {notice ? t(NOTICE_KEYS[notice]) : ''}
    </span>
  );
}

type ExportButtonProps = { disabled: boolean; onClick: () => void };

export function CopyButton({ disabled, onClick }: ExportButtonProps) {
  return (
    <button
      type="button"
      className="button"
      data-testid="viewer-copy"
      disabled={disabled}
      onClick={onClick}
    >
      {t('viewer.copy')}
    </button>
  );
}

export function CsvButton({ disabled, onClick }: ExportButtonProps) {
  return (
    <button
      type="button"
      className="button"
      data-testid="viewer-csv"
      disabled={disabled}
      onClick={onClick}
    >
      {t('viewer.csv')}
    </button>
  );
}

export function Footer({ shown, total, canExport, notice, onCopy, onCsv }: FooterProps) {
  return (
    <footer className="viewer__footer">
      <CountText shown={shown} total={total} />
      <ActionNotice notice={notice} />
      <CopyButton disabled={!canExport} onClick={onCopy} />
      <CsvButton disabled={!canExport} onClick={onCsv} />
    </footer>
  );
}
