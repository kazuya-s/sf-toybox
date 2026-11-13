/**
 * 追加を止める理由（赤字）と「もう一度試す」（frontend-components.md、BR1.2）。
 * 名前の取得と追加前の確認の理由、それに候補の読み込みのログイン切れを出す。
 * 候補の読み込みのほかの失敗と、種類が読めないことは、候補の場所（LoadStatus）に出す。
 * 理由の文言は U1 の messageFor で作り、React の通常の表示だけで出す（NFR3.1）。
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
  // 同じ文言は 1 回だけ出す
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
