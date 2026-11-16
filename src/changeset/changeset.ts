/**
 * Loading outbound change sets (ChangeSet, ADR-001).
 * C4 listComponents, and C5 getChangeSet, checkAddPreconditions and listAddCandidates.
 *
 * Every public function is wrapped in try/catch and returns a Result without throwing (NFR5.1).
 * Failures are logged by the caller (U3, U4) (BR1.7).
 */
import { getPage } from '../salesforce/connection';
import {
  CHANGE_SET_MARKERS,
  ERROR_MESSAGES,
  addPagePath,
  detailPagePath,
  findColumn,
  isSalesforceId,
} from '../salesforce/markers';
import type { FormField, PageForm, ParsedPage } from '../salesforce/types';
import { fail, ok, type Result } from '../shared/result';
import { readAllPages, type PageRead } from './paging';
import type {
  AddCandidate,
  AddCandidates,
  ChangeSetComponent,
  ChangeSetComponents,
  ChangeSetStatus,
  ListComponentsRequest,
  OutboundChangeSet,
} from './types';

const DETAIL = CHANGE_SET_MARKERS.detail;
const ADD = CHANGE_SET_MARKERS.add;

type DetailHeader = { name: string; status: ChangeSetStatus };
type DetailPage = DetailHeader & { components: ChangeSetComponent[] };

/** One row of the Add page. Also holds the checkbox name and value used when sending */
export type CandidateRow = AddCandidate & { checkbox: FormField };
export type AddPage = { candidates: CandidateRow[]; form: PageForm };

function unexpected<T>(message: string): Result<T> {
  return fail('unexpectedResponse', message);
}

/** Reads the change set status from the detail page (BR2.4) */
function readStatus(page: ParsedPage): ChangeSetStatus {
  if (page.exists(DETAIL.uploadAction)) return 'open';
  if (page.exists(DETAIL.uploadedNotice) || page.exists(DETAIL.uploadHistoryRows)) {
    return 'uploaded';
  }
  return 'unknown';
}

function readDetailHeader(page: ParsedPage): Result<DetailHeader> {
  const name = page.text(DETAIL.name);
  if (!name) return unexpected(ERROR_MESSAGES.missingName);
  return ok({ name, status: readStatus(page) });
}

/** Reads the component table on the detail page. If the shape is unexpected, fails instead of guessing (BR2.5, BR2.7) */
function readComponents(page: ParsedPage): Result<ChangeSetComponent[]> {
  const table = page.table(DETAIL.componentTable);
  if (!table) return unexpected(ERROR_MESSAGES.missingTable);
  const nameIndex = findColumn(table.headers, DETAIL.columns.name);
  const parentIndex = findColumn(table.headers, DETAIL.columns.parentObject);
  const typeIndex = findColumn(table.headers, DETAIL.columns.type);
  if (nameIndex < 0 || parentIndex < 0 || typeIndex < 0) {
    return unexpected(ERROR_MESSAGES.missingColumn);
  }

  const components: ChangeSetComponent[] = [];
  for (const row of table.rows) {
    const apiName = row.cells[nameIndex];
    const componentType = row.cells[typeIndex];
    if (row.cells.length < table.headers.length || !apiName || !componentType) {
      return unexpected(ERROR_MESSAGES.unexpectedRow);
    }
    components.push({ componentType, apiName, parentObject: row.cells[parentIndex] || null });
  }
  return ok(components);
}

function readDetailPage(page: ParsedPage): Result<PageRead<DetailPage>> {
  const header = readDetailHeader(page);
  if (!header.ok) return header;
  const components = readComponents(page);
  if (!components.ok) return components;
  return ok({
    data: { ...header.value, components: components.value },
    rowCount: components.value.length,
  });
}

/** Merges rows with the same (componentType, apiName, parentObject) into one, keeping first-seen order (BR2.6) */
function dedupeComponents(components: ChangeSetComponent[]): ChangeSetComponent[] {
  const seen = new Set<string>();
  return components.filter((component) => {
    const key = JSON.stringify([
      component.componentType,
      component.apiName,
      component.parentObject,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Type label: the label of the option with the given value, otherwise the label of the selected option */
function readTypeLabel(page: ParsedPage, componentType: string | undefined): string | null {
  const options = page.options(ADD.typeSelect);
  const option =
    options.find((candidate) => componentType && candidate.value === componentType) ??
    options.find((candidate) => candidate.selected);
  return option?.label || null;
}

/** Reads one page of the Add page (BR3.2, BR3.6). Fails if the form, type or table is missing */
export function readAddPage(
  page: ParsedPage,
  componentType: string | undefined,
): Result<PageRead<AddPage>> {
  const form = page.form(ADD.formSpec);
  if (!form) return unexpected(ERROR_MESSAGES.missingAddForm);
  const typeLabel = readTypeLabel(page, componentType);
  if (!typeLabel) return unexpected(ERROR_MESSAGES.missingTypeLabel);
  const table = page.table(ADD.candidateTable);
  if (!table) return unexpected(ERROR_MESSAGES.missingTable);
  const nameIndex = findColumn(table.headers, ADD.columns.name);
  const parentIndex = findColumn(table.headers, ADD.columns.parentObject);
  if (nameIndex < 0) return unexpected(ERROR_MESSAGES.missingColumn);

  const candidates: CandidateRow[] = [];
  for (const row of table.rows) {
    const name = row.cells[nameIndex];
    if (!row.checkbox?.value || row.cells.length < table.headers.length || !name) {
      return unexpected(ERROR_MESSAGES.unexpectedRow);
    }
    const parentObject = parentIndex < 0 ? null : row.cells[parentIndex] || null;
    candidates.push({
      componentKey: row.checkbox.value,
      name,
      parentObject,
      typeLabel,
      checkbox: row.checkbox,
    });
  }
  return ok({ data: { candidates, form }, rowCount: candidates.length });
}

/** C4: reads every page of the change set's components and merges them (BR2.1-BR2.7) */
export async function listComponents({
  changeSetId,
  onProgress,
}: ListComponentsRequest): Promise<Result<ChangeSetComponents>> {
  try {
    if (!isSalesforceId(changeSetId)) return fail('notFound', ERROR_MESSAGES.invalidChangeSetId);
    const paged = await readAllPages({
      firstPath: detailPagePath(changeSetId),
      parsePage: readDetailPage,
      onProgress,
    });
    if (!paged.ok) return paged;
    const [first] = paged.value.pages;
    if (!first) return unexpected(ERROR_MESSAGES.missingTable);
    return ok({
      changeSet: { changeSetId, name: first.data.name, status: first.data.status },
      components: dedupeComponents(paged.value.pages.flatMap((page) => page.data.components)),
      complete: paged.value.complete,
      failedPages: paged.value.failedPages,
    });
  } catch {
    return unexpected(ERROR_MESSAGES.unexpectedError);
  }
}

/** C5: change set name and status (from the first page of the detail page) */
export async function getChangeSet({
  changeSetId,
}: {
  changeSetId: string;
}): Promise<Result<OutboundChangeSet>> {
  try {
    if (!isSalesforceId(changeSetId)) return fail('notFound', ERROR_MESSAGES.invalidChangeSetId);
    const fetched = await getPage(detailPagePath(changeSetId));
    if (!fetched.ok) return fetched;
    const header = readDetailHeader(fetched.value.page);
    if (!header.ok) return header;
    return ok({ changeSetId, ...header.value });
  } catch {
    return unexpected(ERROR_MESSAGES.unexpectedError);
  }
}

/**
 * C5: pre-add check (BR3.1). Verifies the login, the change set status and that the Add page can be opened.
 * Does not block when the status is unknown.
 */
export async function checkAddPreconditions({
  changeSetId,
}: {
  changeSetId: string;
}): Promise<Result<void>> {
  try {
    const changeSet = await getChangeSet({ changeSetId });
    if (!changeSet.ok) return changeSet;
    if (changeSet.value.status === 'uploaded') {
      return fail('changeSetLocked', ERROR_MESSAGES.changeSetLocked);
    }
    const addPage = await getPage(addPagePath(changeSetId));
    if (!addPage.ok) return addPage;
    if (!addPage.value.page.form(ADD.formSpec)) return unexpected(ERROR_MESSAGES.missingAddForm);
    return ok(undefined);
  } catch {
    return unexpected(ERROR_MESSAGES.unexpectedError);
  }
}

/** C5: reads every page of candidates on the Add page (BR3.6) */
export async function listAddCandidates({
  changeSetId,
  componentType,
}: {
  changeSetId: string;
  componentType: string;
}): Promise<Result<AddCandidates>> {
  try {
    if (!isSalesforceId(changeSetId) || typeof componentType !== 'string' || !componentType) {
      return fail('notFound', ERROR_MESSAGES.invalidRequest);
    }
    const paged = await readAllPages({
      firstPath: addPagePath(changeSetId, componentType),
      parsePage: (page) => readAddPage(page, componentType),
    });
    if (!paged.ok) return paged;
    const candidates = paged.value.pages.flatMap((page) =>
      page.data.candidates.map(({ componentKey, name, parentObject, typeLabel }) => ({
        componentKey,
        name,
        parentObject,
        typeLabel,
      })),
    );
    return ok({ candidates, complete: paged.value.complete, failedPages: paged.value.failedPages });
  } catch {
    return unexpected(ERROR_MESSAGES.unexpectedError);
  }
}
