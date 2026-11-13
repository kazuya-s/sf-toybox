/**
 * 1 件の追加（C5 の SalesforceConnectionApi.addComponent、BR3.2〜BR3.5、security-design.md §5・§6）。
 * 外へは src/salesforce/index.ts から出す。
 *
 * 1. その種類の追加画面を、componentKey の行が見つかるまでページ順に読む（200 ページまで）
 * 2. 見つかったページのフォームから、隠し項目・「追加」ボタン・選んだ 1 件のチェック欄だけを POST で 1 回送る
 * 3. 変更セットを読み直し、種類の表示名と名前が一致する行があれば成功
 *
 * 失敗しても送り直さない。同じ (changeSetId, componentKey) の頼みが動いている間は、新しく送らない。
 */
import { request } from '../salesforce/connection';
import { ERROR_MESSAGES, addPagePath, isSalesforceId } from '../salesforce/markers';
import type { FormField, SalesforceResponse } from '../salesforce/types';
import { fail, ok, type Result } from '../shared/result';
import { listComponents, readAddPage, type CandidateRow, type AddPage } from './changeset';
import { readAllPages } from './paging';
import type { AddRequest } from './types';

type FoundCandidate = { row: CandidateRow; form: AddPage['form']; url: string };

/** 進行中の頼みの表。フレーム（ページ側のプログラム）ごとで、メモリの中だけに持つ */
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

/** 候補を探す。途中のページが読めなければ notFound ではなく、そのページの失敗を返す（BR3.5） */
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

/** 送る項目: 隠し項目、「追加」ボタン、選んだ 1 件のチェック欄だけ（NFR3.2） */
function buildFields({ row, form }: FoundCandidate): FormField[] | null {
  if (!form.submit) return null;
  return [...form.hiddenFields, form.submit, row.checkbox];
}

async function postCandidate(found: FoundCandidate): Promise<Result<SalesforceResponse>> {
  const formFields = buildFields(found);
  if (!formFields) return fail('unexpectedResponse', ERROR_MESSAGES.missingSubmit);
  return request({ path: found.form.action, base: found.url, method: 'POST', formFields });
}

/** 送ったあとに読み直して確かめる（BR3.3）。読み直しが一部だけで見つからなければ確かめられない */
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

/** 1 件を追加する。U4 が 1 件ずつ順に呼ぶ（C5） */
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
