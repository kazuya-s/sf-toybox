/**
 * "Selected: n (k hidden by the filter)" (frontend-components.md, BR2.3).
 */
import { t } from '../../i18n/presentation';

export function SelectionSummary({ selected, hidden }: { selected: number; hidden: number }) {
  return (
    <div data-testid="addassist-selection">
      {t('addAssist.selected', { count: selected })}
      {hidden > 0 ? t('addAssist.selectedHidden', { hidden }) : null}
    </div>
  );
}
