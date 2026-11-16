/**
 * Shapes for C4 and C5 (inception/contract-design/contract-summary.md, functional-design/entities.md).
 * U3 and U4 receive data in these shapes.
 */
import type { LoadProgress } from '../salesforce/types';

export type ChangeSetStatus = 'open' | 'uploaded' | 'unknown';

export type OutboundChangeSet = {
  changeSetId: string;
  name: string;
  status: ChangeSetStatus;
};

export type ChangeSetComponent = {
  /** Type (label shown on the page) */
  componentType: string;
  apiName: string;
  /** null when blank on the page (BR2.5) */
  parentObject: string | null;
};

export type ChangeSetComponents = {
  changeSet: OutboundChangeSet;
  components: ChangeSetComponent[];
  /** When false, some pages could not be loaded (BR2.3) */
  complete: boolean;
  /** Number of pages that could not be loaded. 0 when complete is true */
  failedPages: number;
};

/** One candidate row on the Add page (C5 AddCandidate) */
export type AddCandidate = {
  /** Value passed to addComponent (the row's checkbox value) */
  componentKey: string;
  name: string;
  parentObject: string | null;
  /** Label of the type option on the Add page */
  typeLabel: string;
};

export type AddCandidates = {
  candidates: AddCandidate[];
  complete: boolean;
  failedPages: number;
};

/** Request to add one component (input of C5 addComponent) */
export type AddRequest = {
  changeSetId: string;
  /** Value of the type option on the Add page */
  componentType: string;
  componentKey: string;
};

export type ListComponentsRequest = {
  changeSetId: string;
  /** Called after each page is read. Exceptions thrown inside do not stop the load */
  onProgress?: (progress: LoadProgress) => void;
};

export type { LoadProgress };
