/** 絞り込みで 0 件のときの案内と「絞り込みを解除」（BR2.6） */
import { t } from '../../i18n/presentation';

export type FilteredEmptyProps = { onClear: () => void };

export function FilteredEmpty({ onClear }: FilteredEmptyProps) {
  return (
    <div className="viewer__filtered-empty" data-testid="viewer-filtered-empty">
      <p>{t('viewer.filteredEmpty')}</p>
      <button type="button" className="button" data-testid="viewer-clear-filter" onClick={onClear}>
        {t('viewer.clearFilter')}
      </button>
    </div>
  );
}
