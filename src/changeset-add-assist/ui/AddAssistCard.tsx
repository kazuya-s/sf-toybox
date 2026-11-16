/**
 * The add-assist card (AddAssistCard in frontend-components.md, functional-spec.md F1-F4).
 * State is read from the state.ts store; only the search conditions live in this component.
 * Filtering is computed with useMemo and never calls U2 again (NFR7.4).
 * While adding and while the result panel is open, search, selection and buttons are disabled (BR3.2, BR3.4).
 */
import { useMemo, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { filterCandidates, parentOptions, selectionCounts } from '../filter';
import { canAdd, type AddAssistStore } from '../state';
import { AddButton } from './AddButton';
import { BlockedReason } from './BlockedReason';
import { CandidateList } from './CandidateList';
import { CardHeader } from './CardHeader';
import { LoadStatus } from './LoadStatus';
import { ResultPanel } from './ResultPanel';
import { SearchBar } from './SearchBar';
import { SelectionSummary } from './SelectionSummary';

export type AddAssistCardProps = { store: AddAssistStore };

export function AddAssistCard({ store }: AddAssistCardProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [query, setQuery] = useState('');
  const [parent, setParent] = useState<string | null>(null);

  const parents = useMemo(() => parentOptions(state.candidates), [state.candidates]);
  const visible = useMemo(
    () => filterCandidates(state.candidates, { query, parent }),
    [state.candidates, query, parent],
  );
  const counts = selectionCounts(state.selection, visible);
  const isLocked = state.phase !== 'idle';
  const canRetryCandidates = state.blockReasons.some((reason) => reason.retry === 'candidates');

  // Escape while the result panel is open acts like "Close" (BR3.5)
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') store.closeResult();
  };

  return (
    <article
      className="slds-card sftoybox-add-assist"
      data-testid="addassist-card"
      onKeyDown={handleKeyDown}
    >
      <CardHeader changeSetName={state.changeSetName} isLoading={state.preconditionsLoading} />
      <div className="sftoybox-add-assist__body">
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          parent={parent}
          parents={parents}
          onParentChange={setParent}
          matchCount={visible.length}
          disabled={isLocked}
        />
        <SelectionSummary selected={counts.selected} hidden={counts.hidden} />
        <BlockedReason
          reasons={state.blockReasons}
          retryDisabled={isLocked || state.preconditionsLoading}
          onRetry={() => void store.retryPreconditions()}
        />
        <AddButton
          phase={state.phase}
          selectedCount={state.selection.size}
          progress={state.progress}
          enabled={canAdd(state)}
          onAdd={() => void store.runAdd()}
        />
        {state.phase === 'result' && state.result ? (
          <ResultPanel result={state.result} onClose={store.closeResult} />
        ) : null}
        <LoadStatus
          status={state.candidatesStatus}
          canRetry={canRetryCandidates}
          retryDisabled={isLocked}
          onRetry={() => void store.retryCandidates()}
        />
        {state.candidatesLoaded ? (
          <CandidateList
            candidates={visible}
            selection={state.selection}
            disabled={isLocked}
            onToggle={store.toggleSelection}
          />
        ) : null}
      </div>
    </article>
  );
}
