import { t } from '../i18n/presentation';

/** 「保存しました」を表示する時間（BR1.5） */
export const SAVED_NOTICE_MS = 2000;

/** 保存できたことを短く知らせる。表示の時間は OptionsApp が決める */
export function SavedNotice({ visible }: { visible: boolean }) {
  return (
    <p className="saved-notice" role="status" aria-live="polite" data-testid="options-saved-notice">
      {visible ? `${t('options.saved')} ✓` : ''}
    </p>
  );
}
