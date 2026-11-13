/**
 * ツールバーの画面全体のエラー境界（security-design.md §6、logical-components.md）。
 * 表示中にエラーが起きたら「読み込めませんでした」を出し、固定の識別子だけで記録する。
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
