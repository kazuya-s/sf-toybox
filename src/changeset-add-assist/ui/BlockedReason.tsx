/**
 * Reasons that block adding (in red) and "Try again" (frontend-components.md, BR1.2).
 * Shows reasons from the name load and the pre-add check, plus a session expiry from loading candidates.
 * Other candidate-loading failures and an unreadable type are shown in the candidate area (LoadStatus).
 * Reason text comes from U1's messageFor and is rendered as plain React text only (NFR3.1).
 */
import { messageFor, t } from '../../i18n/presentation';
import type { BlockReason } from '../types';

export type BlockedReasonProps = {
  reasons: readonly BlockReason[];
  onRetry: () => void;
  retryDisabled: boolean;
};

function isShownHere(reason: BlockReason): boolean {
  if (reason.source === 'changeSet' || reason.source === 'preconditions') return true;
  return reason.source === 'candidates' && reason.retry === null;
}

export function BlockedReason({ reasons, onRetry, retryDisabled }: BlockedReasonProps) {
  const shown = reasons.filter(isShownHere);
  if (shown.length === 0) return null;
  // Show the same text only once
  const messages = [...new Set(shown.map((reason) => messageFor(reason)))];
  const canRetry = shown.some((reason) => reason.retry === 'preconditions');

  return (
    <div className="sftoybox-add-assist__error" role="alert" data-testid="addassist-blocked">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
      {canRetry ? (
        <button
          type="button"
          className="slds-button slds-button_neutral"
          disabled={retryDisabled}
          data-testid="addassist-retry"
          onClick={onRetry}
        >
          {t('addAssist.retry')}
        </button>
      ) : null}
    </div>
  );
}
