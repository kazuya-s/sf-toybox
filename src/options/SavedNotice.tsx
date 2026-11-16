import { t } from '../i18n/presentation';

/** How long "Saved" is shown (BR1.5) */
export const SAVED_NOTICE_MS = 2000;

/** Briefly tells the user the save succeeded. OptionsApp decides how long it shows */
export function SavedNotice({ visible }: { visible: boolean }) {
  return (
    <p className="saved-notice" role="status" aria-live="polite" data-testid="options-saved-notice">
      {visible ? `${t('options.saved')} ✓` : ''}
    </p>
  );
}
