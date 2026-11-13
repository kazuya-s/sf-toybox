/**
 * 見出しを固定した表と並べ替え（BR2.1、BR2.2、BR2.7）。
 * 見出しはクリックでも Enter でも並べ替え、aria-sort で向きを示す。
 * 文字は React の通常の表示だけで出す（NFR3.1）。
 */
import type { KeyboardEvent } from 'react';
import { t } from '../../i18n/presentation';
import type { MessageKey } from '../../i18n/message-keys';
import type { ChangeSetComponent, SortColumn, SortState } from '../types';

export type ComponentTableProps = {
  rows: readonly ChangeSetComponent[];
  sort: SortState;
  onSort: (column: SortColumn) => void;
};

const COLUMNS: readonly { column: SortColumn; labelKey: MessageKey; testId: string }[] = [
  { column: 'componentType', labelKey: 'viewer.colType', testId: 'viewer-sort-type' },
  { column: 'apiName', labelKey: 'viewer.colApiName', testId: 'viewer-sort-api-name' },
  { column: 'parentObject', labelKey: 'viewer.colParent', testId: 'viewer-sort-parent' },
];

export function ComponentTable({ rows, sort, onSort }: ComponentTableProps) {
  const handleKeyDown = (event: KeyboardEvent, column: SortColumn) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    onSort(column);
  };

  return (
    <div className="viewer__table-wrap">
      <table className="viewer__table" data-testid="viewer-table">
        <thead>
          <tr>
            {COLUMNS.map(({ column, labelKey, testId }) => (
              <th
                key={column}
                scope="col"
                tabIndex={0}
                aria-sort={sort.column === column ? sort.direction : 'none'}
                data-testid={testId}
                onClick={() => onSort(column)}
                onKeyDown={(event) => handleKeyDown(event, column)}
              >
                {t(labelKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}:${row.componentType}:${row.apiName}`}>
              <td>{row.componentType}</td>
              <td>{row.apiName}</td>
              <td>{row.parentObject ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
