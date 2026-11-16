/** Yellow banner and "Try again" when only part was loaded (BR1.4, BR1.5) */
import { t } from '../../i18n/presentation';

export type PartialBannerProps = { onRetry: () => void; isRetrying: boolean };

export function PartialBanner({ onRetry, isRetrying }: PartialBannerProps) {
  return (
    <div className="viewer__banner" role="alert" data-testid="viewer-partial">
      <span>{t('viewer.partial')}</span>
      <button
        type="button"
        className="button"
        data-testid="viewer-retry"
        onClick={onRetry}
        disabled={isRetrying}
      >
        {t('viewer.retry')}
      </button>
    </div>
  );
}
