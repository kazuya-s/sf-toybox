/**
 * 追加支援のエラー境界（U4 security-design.md §6、NFR5.1）。
 * 表示中にエラーが起きても Salesforce の画面は壊さず、追加支援を外して記録する。
 * 追加中だったときは state.ts の「中止」の印を立て、runAdd は今の 1 件のあとで止まる。
 * そのときは「追加を途中で止めました」を出す。離れるときの確認は runAdd が外すまで残る。
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
