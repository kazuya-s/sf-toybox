/**
 * 送信変更セットの読み込み（ChangeSet、ADR-001）。
 * C4 の listComponents と、C5 の getChangeSet・checkAddPreconditions・listAddCandidates。
 *
 * 公開する関数は、すべて try/catch で包み、例外を外に出さずに Result を返す（NFR5.1）。
 * 失敗の記録は使う側（U3・U4）が行う（BR1.7）。
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

/** 追加画面の 1 行。送るときに使うチェック欄の名前と値も持つ */
export type CandidateRow = AddCandidate & { checkbox: FormField };
export type AddPage = { candidates: CandidateRow[]; form: PageForm };

function unexpected<T>(message: string): Result<T> {
  return fail('unexpectedResponse', message);
}

/** 変更セットの状態を、詳細画面の表示から読む（BR2.4） */
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

/** 詳細画面のコンポーネントの表を読む。想定と違う形なら推測せずに失敗にする（BR2.5、BR2.7） */
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

/** (componentType, apiName, parentObject) が同じものを、最初の順のまま 1 件にまとめる（BR2.6） */
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

/** 種類の表示名: 指定した値の選択肢の表示名。なければ選ばれている選択肢の表示名 */
function readTypeLabel(page: ParsedPage, componentType: string | undefined): string | null {
  const options = page.options(ADD.typeSelect);
  const option =
    options.find((candidate) => componentType && candidate.value === componentType) ??
    options.find((candidate) => candidate.selected);
  return option?.label || null;
}

/** 追加画面の 1 ページを読む（BR3.2、BR3.6）。フォーム・種類・表のどれかがなければ失敗 */
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

/** C4: 変更セットのコンポーネントを全ページ読んで 1 つにまとめる（BR2.1〜BR2.7） */
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

/** C5: 変更セットの名前と状態（詳細画面の 1 ページ目から） */
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
 * C5: 追加の前の確認（BR3.1）。ログイン・変更セットの状態・追加画面を開けるかを確かめる。
 * 状態が unknown のときは止めない。
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

/** C5: 追加画面の候補を全ページ読んで返す（BR3.6） */
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
