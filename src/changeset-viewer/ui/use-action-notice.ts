/** Shows the output result for 2 seconds (BR3.8) */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionNoticeKind } from './Footer';

export const ACTION_NOTICE_MS = 2_000;

export function useActionNotice() {
  const [notice, setNotice] = useState<ActionNoticeKind>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback((kind: Exclude<ActionNoticeKind, null>) => {
    if (timer.current) clearTimeout(timer.current);
    setNotice(kind);
    timer.current = setTimeout(() => setNotice(null), ACTION_NOTICE_MS);
  }, []);

  return { notice, show };
}
