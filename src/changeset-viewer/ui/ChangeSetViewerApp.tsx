/**
 * The toolbar popup (ChangeSetViewerApp in frontend-components.md, mockups.md S3, functional-spec.md F1, F3, F4).
 * Layout: Header, StatusView, PartialBanner, FilterBar, ComponentTable, FilteredEmpty, Footer.
 * Wrapped in an error boundary (NFR5.1). Filtering and sorting use useMemo and never re-request (NFR7.4).
 */
import { useMemo, useState } from 'react';
import { t } from '../../i18n/presentation';
import { INITIAL_SORT, NO_FILTER, createCollator } from '../view-state';
import type { RowFilter, SortState } from '../types';
import { ComponentListView } from './ComponentListView';
import { StatusView } from './StatusView';
import { ViewerErrorBoundary } from './ViewerErrorBoundary';
import { useViewerLoader } from './use-viewer-loader';

function openSettings(): void {
  Promise.resolve(chrome.runtime.openOptionsPage()).catch((error: unknown) => {
    console.error('[sf-toybox:changeset-viewer]', 'openOptionsPage failed', error);
  });
}

function ViewerContent() {
  const { phase, isLoading, retry } = useViewerLoader();
  // Conditions survive a reload (BR1.5)
  const [filter, setFilter] = useState<RowFilter>(NO_FILTER);
  const [sort, setSort] = useState<SortState>(INITIAL_SORT);
  const collator = useMemo(() => createCollator(chrome.i18n.getUILanguage()), []);

  if (phase.kind === 'starting' || phase.kind === 'loading') {
    return (
      <StatusView kind="loading" progress={phase.kind === 'loading' ? phase.progress : null} />
    );
  }
  if (phase.kind === 'disabled') {
    return <StatusView kind="disabled" onOpenSettings={openSettings} />;
  }
  if (phase.kind === 'wrong-page') return <StatusView kind="wrong-page" />;

  const { result, state } = phase;
  if (!result.ok) {
    return state === 'session-expired' ? (
      <StatusView kind="session-expired" />
    ) : (
      <StatusView kind="error" showReloadHint={result.error.kind === 'notFound'} onRetry={retry} />
    );
  }
  return (
    <ComponentListView
      data={result.value}
      baseState={state}
      filter={filter}
      sort={sort}
      collator={collator}
      isRetrying={isLoading}
      onFilterChange={setFilter}
      onSortChange={setSort}
      onRetry={retry}
    />
  );
}

export function ChangeSetViewerApp() {
  return (
    <ViewerErrorBoundary>
      <main className="viewer" aria-label={t('tool.changesetViewer.name')}>
        <ViewerContent />
      </main>
    </ViewerErrorBoundary>
  );
}
