/**
 * Names of the in-extension message channels (contract-summary.md C4, security-design.md §4).
 * U1's sftoybox/page-info is PAGE_INFO_CHANNEL in src/page/page-info-responder.ts.
 * U3's channels are kept here (U1's file is not changed).
 */

/** Popup -> page: request the change set component list */
export const CHANGESET_COMPONENTS_CHANNEL = 'sftoybox/changeset/components';

/** Page -> popup: progress of loading the list */
export const CHANGESET_PROGRESS_CHANNEL = 'sftoybox/changeset/progress';
