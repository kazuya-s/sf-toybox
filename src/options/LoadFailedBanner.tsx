import { t } from '../i18n/presentation';

/** Notice shown only when the settings could not be loaded (BR1.3, AC1.1.5) */
export function LoadFailedBanner() {
  return (
    <div className="banner banner--warning" role="alert" data-testid="options-load-failed">
      {t('options.loadFailed')}
    </div>
  );
}
