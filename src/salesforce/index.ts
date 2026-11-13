/**
 * SalesforceConnection の入口（contract-summary.md C5 の SalesforceConnectionApi）。
 * U3・U4 はこのファイルと src/changeset/index.ts だけを読み込む。
 * addComponent の中身は src/changeset/add-component.ts にある（logical-components.md）。
 */
export { addComponent } from '../changeset/add-component';
export type { AddRequest } from '../changeset/types';
export type { LoadProgress } from './types';
