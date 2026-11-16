/**
 * Flow on open and reloading (functional-spec.md F1, rules.md BR1.1-BR1.6).
 * ON/OFF -> page detection -> list request (with progress) -> decide state -> log failures.
 * The request is made once on open; filtering and sorting never re-request (NFR7.4).
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

/** Logs a failure with only the tool ID, kind and message key (BR1.6, NFR1.3) */
function logResult(state: ResultState, result: ComponentsResult): void {
  const messageKey = LOG_KEYS[state];
  if (!messageKey) return;
  // partial means some pages failed and no kind is returned, so it is logged as unexpected
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
    // Do not request again while reloading (BR1.5)
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
    // Even if StrictMode runs the effect twice, ask only once
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
