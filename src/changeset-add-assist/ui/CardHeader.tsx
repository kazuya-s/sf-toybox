/**
 * カードの見出し: 「sf-toybox 検索」と「追加先: <名前>」（frontend-components.md、BR1.2）。
 * 名前は React の通常の表示（文字として扱われる）だけで出す（NFR3.1）。
 */
import { t } from '../../i18n/presentation';

export type CardHeaderProps = {
  changeSetName: string | null;
  isLoading: boolean;
};

export function CardHeader({ changeSetName, isLoading }: CardHeaderProps) {
  let target: string | null = null;
  if (changeSetName !== null) target = t('addAssist.target', { name: changeSetName });
  else if (isLoading) target = t('addAssist.loadingName');

  return (
    <div className="slds-card__header">
      <h2 className="slds-card__header-title">
        <span>{t('addAssist.title')}</span>
        {target !== null ? (
          <span className="sftoybox-add-assist__target" data-testid="addassist-target">
            {target}
          </span>
        ) : null}
      </h2>
    </div>
  );
}
