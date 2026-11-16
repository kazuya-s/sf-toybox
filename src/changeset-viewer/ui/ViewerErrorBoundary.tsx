/**
 * Error boundary for the whole toolbar popup (security-design.md §6, logical-components.md).
 * On a render error it shows "Could not load" and logs with fixed IDs only.
 */
import { Component, type ReactNode } from 'react';
import { recordError } from '../../errors/error-log';
import { t } from '../../i18n/presentation';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ViewerErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error): void {
    void recordError(
      { toolId: 'changeset-viewer', kind: 'unexpected', messageKey: 'errorLog.viewerRenderFailed' },
      error,
    );
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="viewer">
          <div className="viewer__status viewer__status--error" data-testid="viewer-render-error">
            <p>{t('viewer.error')}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
