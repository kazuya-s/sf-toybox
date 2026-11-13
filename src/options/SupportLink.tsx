import { t } from '../i18n/presentation';

/** 問い合わせ窓口（GitHub の課題報告ページ）へのリンク（BR1.8、AC1.1.6） */
export function SupportLink({ url }: { url: string | null }) {
  if (!url) {
    return (
      <p className="support" data-testid="options-support-pending">
        {t('options.support')}: {t('options.supportPending')}
      </p>
    );
  }
  return (
    <p className="support">
      <a href={url} target="_blank" rel="noopener noreferrer" data-testid="options-support-link">
        {t('options.support')}
      </a>
    </p>
  );
}
