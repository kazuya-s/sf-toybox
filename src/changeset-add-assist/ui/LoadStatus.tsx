/**
 * Candidate loading status: loading, partial failure, load failure with "Try again", unreadable type
 * (frontend-components.md, BR1.3, BR1.4, NFR7.3).
 */
import { t } from '../../i18n/presentation';
import type { CandidatesStatus } from '../types';

export type LoadStatusProps = {
  status: CandidatesStatus;
  /** Whether to show "Try again" for candidates (hidden on session expiry) */
  canRetry: boolean;
  retryDisabled: boolean;
  onRetry: () => void;
};

function RetryButton({ disabled, onRetry }: { disabled: boolean; onRetry: () => void }) {
  return (
    <button
      type="button"
      className="slds-button slds-button_neutral"
      disabled={disabled}
      data-testid="addassist-retry-candidates"
      onClick={onRetry}
    >
      {t('addAssist.retry')}
    </button>
  );
}

export function LoadStatus({ status, canRetry, retryDisabled, onRetry }: LoadStatusProps) {
  switch (status) {
    case 'loading':
      return (
        <div role="status" data-testid="addassist-loading">
          {t('addAssist.loadingCandidates')}
        </div>
      );
    case 'partial':
    case 'error':
      return (
        <div className="sftoybox-add-assist__error" role="alert" data-testid="addassist-load-error">
          <span>{status === 'partial' ? t('addAssist.partial') : t('addAssist.loadError')}</span>
          {status === 'partial' || canRetry ? (
            <RetryButton disabled={retryDisabled} onRetry={onRetry} />
          ) : null}
        </div>
      );
    case 'typeUnreadable':
      return (
        <div
          className="sftoybox-add-assist__error"
          role="alert"
          data-testid="addassist-type-unreadable"
        >
          {t('addAssist.typeUnreadable')}
        </div>
      );
    default:
      return null;
  }
}
