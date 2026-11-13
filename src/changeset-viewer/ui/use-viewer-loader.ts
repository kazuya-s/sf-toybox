/**
 * 開いたときの流れと読み直し（functional-spec.md F1、rules.md BR1.1〜BR1.6）。
 * ON/OFF → 画面の判定 → 一覧の頼み（進み具合つき）→ 状態の決定 → 失敗の記録。
 * 頼みは開いたときに 1 回だけ行い、絞り込みや並べ替えでは頼み直さない（NFR7.4）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoadProgress } from '../../changeset';
import { recordError, type ErrorLogKind } from '../../errors/error-log';
import type { MessageKey } from '../../i18n/message-keys';
import { isEnabled } from '../../settings/tool-settings';
import { fail } from '../../shared/result';
import { askPageInfo, getActiveTabId, requestComponents } from '../popup-client';
import type { ComponentsResult, ResultState } from '../types';
import { stateFromResult } from '../view-state';

export type LoaderPhase =
  | { kind: 'starting' }
  | { kind: 'disabled' }
  | { kind: 'wrong-page' }
  | { kind: 'loading'; progress: LoadProgress | null }
  | { kind: 'loaded'; state: ResultState; result: ComponentsResult };

type Target = { tabId: number; changeSetId: string };

const LOG_KEYS: Partial<Record<ResultState, MessageKey>> = {
  error: 'errorLog.viewerLoadFailed',
  'session-expired': 'errorLog.viewerSessionExpired',
  partial: 'errorLog.viewerPartial',
};

/** 失敗をツールの識別子・種類・文言の識別子だけで記録する（BR1.6、NFR1.3） */
function logResult(state: ResultState, result: ComponentsResult): void {
  const messageKey = LOG_KEYS[state];
  if (!messageKey) return;
  // partial は一部のページの失敗で、種類は返ってこないため unexpected とする
  const kind: ErrorLogKind = result.ok ? 'unexpected' : result.error.kind;
  void recordError({ toolId: 'changeset-viewer', kind, messageKey });
}

async function findTarget(): Promise<Target | 'disabled' | 'wrong-page'> {
  if (!(await isEnabled({ toolId: 'changeset-viewer' }))) return 'disabled';
  const tabId = await getActiveTabId();
  if (tabId === null) return 'wrong-page';
  const page = await askPageInfo(tabId);
  return page.kind === 'detail' ? { tabId, changeSetId: page.changeSetId } : 'wrong-page';
}

export function useViewerLoader() {
  const [phase, setPhase] = useState<LoaderPhase>({ kind: 'starting' });
  const target = useRef<Target | null>(null);
  const isMounted = useRef(false);
  const hasStarted = useRef(false);

  const isInFlight = useRef(false);

  const load = useCallback(async () => {
    const current = target.current;
    // 読み直しのあいだは、もう一度頼まない（BR1.5）
    if (!current || isInFlight.current) return;
    isInFlight.current = true;
    setPhase({ kind: 'loading', progress: null });
    let result: ComponentsResult;
    try {
      result = await requestComponents(current.tabId, current.changeSetId, (progress) => {
        if (isMounted.current) {
          setPhase((prev) => (prev.kind === 'loading' ? { kind: 'loading', progress } : prev));
        }
      });
    } catch {
      result = fail('unexpectedResponse', 'components request threw');
    } finally {
      isInFlight.current = false;
    }
    if (!isMounted.current) return;
    const state = stateFromResult(result);
    setPhase({ kind: 'loaded', state, result });
    logResult(state, result);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    // StrictMode で効果が 2 回動いても、問い合わせは 1 回だけにする
    if (hasStarted.current) return;
    hasStarted.current = true;
    void (async () => {
      const found = await findTarget();
      if (!isMounted.current) return;
      if (found === 'disabled' || found === 'wrong-page') {
        setPhase({ kind: found });
        return;
      }
      target.current = found;
      await load();
    })();
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  return { phase, isLoading: phase.kind === 'loading', retry };
}
