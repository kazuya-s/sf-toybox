/**
 * Result panel: SucceededList, FailedList, UntriedList, CloseButton (frontend-components.md, BR3.4, BR3.5).
 * Moves focus to the heading when opened. Closing ("Close" and Escape) goes only through closeResult in state.ts.
 * Names and reasons are rendered as plain React text only (NFR3.1).
 */
import { useEffect, useId, useRef } from 'react';
import type { AddCandidate } from '../../changeset/index';
import { messageFor, t } from '../../i18n/presentation';
import type { AppError } from '../../shared/result';
import type { AddResult, FailedAdd } from '../types';

/** Reason text. unexpectedResponse becomes "Could not confirm the add" (U2 BR3.3) */
export function failureMessage(error: AppError): string {
  return error.kind === 'unexpectedResponse' ? t('addAssist.unconfirmed') : messageFor(error);
}

function NameList({ testId, items }: { testId: string; items: readonly AddCandidate[] }) {
  return (
    <ul data-testid={testId}>
      {items.map((candidate) => (
        <li key={candidate.componentKey}>{candidate.name}</li>
      ))}
    </ul>
  );
}

function FailedList({ items }: { items: readonly FailedAdd[] }) {
  return (
    <ul data-testid="addassist-result-failed">
      {items.map(({ candidate, error }) => (
        <li key={candidate.componentKey}>
          <span>{candidate.name}</span>
          <span>: </span>
          <span className="sftoybox-add-assist__error">{failureMessage(error)}</span>
        </li>
      ))}
    </ul>
  );
}

export type ResultPanelProps = {
  result: AddResult;
  onClose: () => void;
};

export function ResultPanel({ result, onClose }: ResultPanelProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      className="sftoybox-add-assist__result"
      role="region"
      aria-labelledby={headingId}
      data-testid="addassist-result"
    >
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="slds-text-heading_small">
        {t('addAssist.resultTitle')}
      </h2>
      <h3>{t('addAssist.succeeded', { count: result.succeeded.length })}</h3>
      <NameList testId="addassist-result-succeeded" items={result.succeeded} />
      <h3>{t('addAssist.failed', { count: result.failed.length })}</h3>
      <FailedList items={result.failed} />
      <h3>{t('addAssist.untried', { count: result.untried.length })}</h3>
      <NameList testId="addassist-result-untried" items={result.untried} />
      <button
        type="button"
        className="slds-button slds-button_neutral"
        data-testid="addassist-result-close"
        onClick={onClose}
      >
        {t('addAssist.close')}
      </button>
    </section>
  );
}
