/**
 * Error boundary for the add assistant (U4 security-design.md §6, NFR5.1).
 * A render error never breaks the Salesforce page; the widget is removed and the error logged.
 * If adding was in progress, it sets the "abort" flag in state.ts and runAdd stops after the current item.
 * It then shows "Stopped adding midway". The leave-page confirmation stays until runAdd removes it.
 */
import { Component, type ReactNode } from 'react';
import { recordError } from '../../errors/error-log';
import { t } from '../../i18n/presentation';
import { ADD_ASSIST_TOOL_ID, type AddAssistStore } from '../state';

type BoundaryProps = { store: AddAssistStore; children: ReactNode };
type BoundaryState = { hasFailed: boolean; wasAdding: boolean };

export class AddAssistBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { hasFailed: false, wasAdding: false };

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { hasFailed: true };
  }

  override componentDidCatch(error: unknown): void {
    const { store } = this.props;
    const wasAdding = store.getState().phase === 'adding';
    store.abort();
    this.setState({ wasAdding });
    void recordError(
      {
        toolId: ADD_ASSIST_TOOL_ID,
        kind: 'unexpected',
        messageKey: 'errorLog.addAssistRenderFailed',
      },
      error,
    );
  }

  override render(): ReactNode {
    if (!this.state.hasFailed) return this.props.children;
    if (!this.state.wasAdding) return null;
    return (
      <div className="sftoybox-add-assist__error" role="alert" data-testid="addassist-aborted">
        {t('addAssist.aborted')}
      </div>
    );
  }
}
