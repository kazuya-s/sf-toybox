/**
 * 状態ごとの案内: disabled / wrong-page / loading / empty / error / session-expired（BR1.1〜BR1.4）。
 */
import type { LoadProgress } from '../../changeset';
import { t } from '../../i18n/presentation';

export type StatusKind =
  'disabled' | 'wrong-page' | 'loading' | 'empty' | 'error' | 'session-expired';

export type StatusViewProps = {
  kind: StatusKind;
  progress?: LoadProgress | null;
  /** error のとき、受け取るフレームがなかったら再読み込みの案内を添える（performance-design.md §3） */
  showReloadHint?: boolean;
  onRetry?: () => void;
  onOpenSettings?: () => void;
};

function loadingText(progress: LoadProgress | null | undefined): string {
  const loaded = progress?.loadedPages ?? 0;
  const total = progress?.totalPages ?? null;
  return total === null
    ? t('viewer.loadingUnknown', { loaded })
    : t('viewer.loading', { loaded, total });
}

const TEXT_KEYS = {
  disabled: 'viewer.disabled',
  'wrong-page': 'viewer.wrongPage',
  empty: 'viewer.empty',
  error: 'viewer.error',
  'session-expired': 'viewer.sessionExpired',
} as const;

export function StatusView({
  kind,
  progress,
  showReloadHint,
  onRetry,
  onOpenSettings,
}: StatusViewProps) {
  const text = kind === 'loading' ? loadingText(progress) : t(TEXT_KEYS[kind]);
  return (
    <div
      className={`viewer__status${kind === 'error' ? ' viewer__status--error' : ''}`}
      data-testid={`viewer-status-${kind}`}
      role={kind === 'loading' ? 'status' : undefined}
    >
      <p>{text}</p>
      {kind === 'error' && showReloadHint && <p>{t('viewer.reloadHint')}</p>}
      {kind === 'disabled' && (
        <button
          type="button"
          className="button"
          data-testid="viewer-open-settings"
          onClick={onOpenSettings}
        >
          {t('viewer.openSettings')}
        </button>
      )}
      {kind === 'error' && (
        <button type="button" className="button" data-testid="viewer-retry" onClick={onRetry}>
          {t('viewer.retry')}
        </button>
      )}
    </div>
  );
}
