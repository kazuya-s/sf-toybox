/**
 * SalesforceConnection entry point (SalesforceConnectionApi of C5 in contract-summary.md).
 * U3 and U4 import only this file and src/changeset/index.ts.
 * addComponent is implemented in src/changeset/add-component.ts (logical-components.md).
 */
export { addComponent } from '../changeset/add-component';
export type { AddRequest } from '../changeset/types';
export type { LoadProgress } from './types';
