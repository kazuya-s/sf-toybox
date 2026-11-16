/** Header: "Change set: <name>" and "m items" (BR2.5) */
import { t } from '../../i18n/presentation';

export type HeaderProps = { name: string; total: number };

export function Header({ name, total }: HeaderProps) {
  return (
    <header className="viewer__header">
      <h1 data-testid="viewer-title">{t('viewer.changeSet', { name })}</h1>
      <span className="viewer__total" data-testid="viewer-total">
        {t('viewer.total', { count: total })}
      </span>
    </header>
  );
}
