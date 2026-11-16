/**
 * Adds one component (C5 SalesforceConnectionApi.addComponent, BR3.2-BR3.5, security-design.md §5, §6).
 * Exported through src/salesforce/index.ts.
 *
 * 1. Reads the Add page for the type page by page until the componentKey row is found (up to 200 pages)
 * 2. POSTs once from that page's form with only the hidden fields, the "Add" button and the one selected checkbox
 * 3. Reloads the change set; succeeds if a row with the same type label and name is found
 *
 * Never resends on failure. While a request for the same (changeSetId, componentKey) is running, no new one is sent.
 */
import { request } from '../salesforce/connection';
import { ERROR_MESSAGES, addPagePath, isSalesforceId } from '../salesforce/markers';
import type { FormField, SalesforceResponse } from '../salesforce/types';
import { fail, ok, type Result } from '../shared/result';
import { listComponents, readAddPage, type CandidateRow, type AddPage } from './changeset';
import { readAllPages } from './paging';
import type { AddRequest } from './types';

type FoundCandidate = { row: CandidateRow; form: AddPage['form']; url: string };

/** In-flight request table. Per frame (page-side program), kept only in memory */
const inFlight = new Map<string, Promise<Result<void>>>();

function isValidRequest({ changeSetId, componentType, componentKey }: AddRequest): boolean {
  return (
    isSalesforceId(changeSetId) &&
    typeof componentType === 'string' &&
    componentType.length > 0 &&
    typeof componentKey === 'string' &&
    componentKey.length > 0
  );
}

/** Finds the candidate. If a page in between cannot be read, returns that page's failure, not notFound (BR3.5) */
async function findCandidate({
  changeSetId,
  componentType,
  componentKey,
}: AddRequest): Promise<Result<FoundCandidate>> {
  const hasKey = (page: AddPage) =>
    page.candidates.some((candidate) => candidate.componentKey === componentKey);
  const paged = await readAllPages({
    firstPath: addPagePath(changeSetId, componentType),
    parsePage: (page) => readAddPage(page, componentType),
    stopWhen: hasKey,
  });
  if (!paged.ok) return paged;

  for (const { data, url } of paged.value.pages) {
    const row = data.candidates.find((candidate) => candidate.componentKey === componentKey);
    if (row) return ok({ row, form: data.form, url });
  }
  if (paged.value.pageError) return { ok: false, error: paged.value.pageError };
  return fail('notFound', ERROR_MESSAGES.candidateNotFound);
}

/** Fields to send: only the hidden fields, the "Add" button and the one selected checkbox (NFR3.2) */
function buildFields({ row, form }: FoundCandidate): FormField[] | null {
  if (!form.submit) return null;
  return [...form.hiddenFields, form.submit, row.checkbox];
}

async function postCandidate(found: FoundCandidate): Promise<Result<SalesforceResponse>> {
  const formFields = buildFields(found);
  if (!formFields) return fail('unexpectedResponse', ERROR_MESSAGES.missingSubmit);
  return request({ path: found.form.action, base: found.url, method: 'POST', formFields });
}

/** Reloads after sending to verify (BR3.3). If the reload is partial and the row is missing, it cannot be verified */
async function confirmAdded(changeSetId: string, row: CandidateRow): Promise<Result<void>> {
  const reread = await listComponents({ changeSetId });
  if (!reread.ok) return reread;
  const added = reread.value.components.some(
    (component) => component.componentType === row.typeLabel && component.apiName === row.name,
  );
  return added ? ok(undefined) : fail('unexpectedResponse', ERROR_MESSAGES.addNotConfirmed);
}

async function runAdd(addRequest: AddRequest): Promise<Result<void>> {
  try {
    if (!isValidRequest(addRequest)) return fail('notFound', ERROR_MESSAGES.invalidRequest);
    const found = await findCandidate(addRequest);
    if (!found.ok) return found;
    const sent = await postCandidate(found.value);
    if (!sent.ok) return sent;
    return await confirmAdded(addRequest.changeSetId, found.value.row);
  } catch {
    return fail('unexpectedResponse', ERROR_MESSAGES.unexpectedError);
  }
}

/** Adds one component. U4 calls it one at a time in order (C5) */
export function addComponent(addRequest: AddRequest): Promise<Result<void>> {
  const key = JSON.stringify([addRequest.changeSetId, addRequest.componentKey]);
  const running = inFlight.get(key);
  if (running) return running;

  const task = runAdd(addRequest).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, task);
  return task;
}
