import { t } from '../i18n/presentation';

/** 設定を読み込めなかったときだけ出すお知らせ（BR1.3、AC1.1.5） */
export function LoadFailedBanner() {
  return (
    <div className="banner banner--warning" role="alert" data-testid="options-load-failed">
      {t('options.loadFailed')}
    </div>
  );
}
