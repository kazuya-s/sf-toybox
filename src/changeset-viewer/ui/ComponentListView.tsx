/**
 * View and output once the list is loaded (default / empty / partial / filtered-empty) (BR2.1-BR3.8).
 * Output functions (copyRows, saveCsv) are called only from the Copy and CSV buttons' onClick (NFR1.2).
 */
import { useEffect, useMemo, useRef } from 'react';
import { recordError } from '../../errors/error-log';
import { t } from '../../i18n/presentation';
import { copyRows, csvFileName, saveCsv, toCsv, toTsv, type ExportHeaders } from '../export';
import type { ChangeSetComponents, ResultState, RowFilter, SortColumn, SortState } from '../types';
import {
  NO_FILTER,
  displayState,
  filterRows,
  nextSort,
  sortRows,
  typeOptions,
} from '../view-state';
import { ComponentTable } from './ComponentTable';
import { FilterBar } from './FilterBar';
import { FilteredEmpty } from './FilteredEmpty';
import { Footer } from './Footer';
import { Header } from './Header';
import { PartialBanner } from './PartialBanner';
import { StatusView } from './StatusView';
import { useActionNotice } from './use-action-notice';

export type ComponentListViewProps = {
  data: ChangeSetComponents;
  baseState: ResultState;
  filter: RowFilter;
  sort: SortState;
  collator: Intl.Collator;
  isRetrying: boolean;
  onFilterChange: (filter: RowFilter) => void;
  onSortChange: (sort: SortState) => void;
  onRetry: () => void;
};

function exportHeaders(): ExportHeaders {
  return [t('viewer.colType'), t('viewer.colApiName'), t('viewer.colParent')];
}

export function ComponentListView(props: ComponentListViewProps) {
  const { data, baseState, filter, sort, collator } = props;
  const nameInput = useRef<HTMLInputElement>(null);
  const { notice, show } = useActionNotice();

  const types = useMemo(() => typeOptions(data.components, collator), [data, collator]);
  const shown = useMemo(
    () => sortRows(filterRows(data.components, filter), sort, collator),
    [data, filter, sort, collator],
  );
  const state = displayState(baseState, shown.length);
  const total = data.components.length;

  useEffect(() => {
    nameInput.current?.focus();
  }, []);

  const handleCopy = async () => {
    const result = await copyRows(toTsv(shown, exportHeaders()));
    show(result.ok ? 'copied' : 'copyFailed');
    if (!result.ok) {
      void recordError({
        toolId: 'changeset-viewer',
        kind: result.error.kind,
        messageKey: 'errorLog.viewerCopyFailed',
      });
    }
  };

  const handleCsv = () => {
    const fileName = csvFileName(data.changeSet.name, new Date());
    const result = saveCsv(toCsv(shown, exportHeaders()), fileName);
    show(result.ok ? 'saved' : 'saveFailed');
    if (!result.ok) {
      void recordError({
        toolId: 'changeset-viewer',
        kind: result.error.kind,
        messageKey: 'errorLog.viewerSaveFailed',
      });
    }
  };

  const handleSort = (column: SortColumn) => props.onSortChange(nextSort(sort, column));

  return (
    <>
      <Header name={data.changeSet.name} total={total} />
      {baseState === 'partial' && (
        <PartialBanner onRetry={props.onRetry} isRetrying={props.isRetrying} />
      )}
      {state === 'empty' ? (
        <StatusView kind="empty" />
      ) : (
        <>
          <FilterBar
            filter={filter}
            types={types}
            onChange={props.onFilterChange}
            nameInputRef={nameInput}
          />
          {state === 'filtered-empty' ? (
            <FilteredEmpty onClear={() => props.onFilterChange(NO_FILTER)} />
          ) : (
            <ComponentTable rows={shown} sort={sort} onSort={handleSort} />
          )}
        </>
      )}
      <Footer
        shown={shown.length}
        total={total}
        canExport={shown.length > 0}
        notice={notice}
        onCopy={() => void handleCopy()}
        onCsv={handleCsv}
      />
    </>
  );
}
