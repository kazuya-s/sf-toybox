/**
 * Reads the value of the type selected on the current "Add" page (U4 functional-design/rules.md BR1.3).
 * Uses only the single marker CHANGE_SET_MARKERS.add.typeSelect in src/salesforce/markers.ts.
 * No network; it only reads the select's value in that frame's document.
 */
import { CHANGE_SET_MARKERS } from '../salesforce/markers';

/** Candidate table on the "Add" page. The add assistant goes right above it (U4 BR1.5). null if missing */
export function findCandidateTable(doc: Document): Element | null {
  return doc.querySelector(CHANGE_SET_MARKERS.add.candidateTable.table);
}

/** Current value of the type select. null when the select is missing or its value is empty */
export function readSelectedComponentType(doc: Document): string | null {
  const select = doc.querySelector<HTMLSelectElement>(CHANGE_SET_MARKERS.add.typeSelect);
  if (select?.tagName !== 'SELECT') return null;
  const value = select.value.trim();
  return value === '' ? null : value;
}
