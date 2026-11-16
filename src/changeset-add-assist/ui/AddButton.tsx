/**
 * "Add n selected" / "Adding… (i / n)" (frontend-components.md, BR2.5, BR3.1, BR3.2, BR3.6).
 * Enabled state comes from state.ts canAdd alone. Enter adds only when this button has focus
 * (the button's default behavior). While adding, the leave-page notice is always shown next to the button.
 */
import { t } from '../../i18n/presentation';
import type { AddAssistPhase, AddProgress } from '../types';

export type AddButtonProps = {
  phase: AddAssistPhase;
  selectedCount: number;
  progress: AddProgress | null;
  enabled: boolean;
  onAdd: () => void;
};

export function AddButton({ phase, selectedCount, progress, enabled, onAdd }: AddButtonProps) {
  const label =
    phase === 'adding' && progress
      ? t('addAssist.adding', { done: progress.done, total: progress.total })
      : t('addAssist.add', { count: selectedCount });

  return (
    <div className="sftoybox-add-assist__actions">
      <button
        type="button"
        className="slds-button slds-button_brand"
        disabled={!enabled}
        aria-busy={phase === 'adding'}
        data-testid="addassist-add"
        onClick={onAdd}
      >
        {label}
      </button>
      {phase === 'idle' && selectedCount === 0 ? (
        <span data-testid="addassist-select-hint">{t('addAssist.selectSomething')}</span>
      ) : null}
      {phase === 'adding' ? (
        <span
          className="sftoybox-add-assist__error"
          role="status"
          data-testid="addassist-leave-warning"
        >
          {t('addAssist.leaveWarning')}
        </span>
      ) : null}
    </div>
  );
}
