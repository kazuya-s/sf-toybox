/**
 * 画面を読み取るための目印の定義（functional-design/rules.md の BR1.5）。
 *
 * 詳細画面・追加画面の HTML の作りは、B2 の手での確認（docs/manual-check.md）で確かめる前提の初めの値。
 * 実際の画面と合わなければ、このファイルだけを直す。
 */
import type { FormSpec, ParsedPage, TableSpec } from './types';

/** 1 回のやり取りの打ち切りまでの時間（BR1.3） */
export const REQUEST_TIMEOUT_MS = 30_000;

/** 1 回の読み込みで読むページの上限（BR2.2） */
export const MAX_PAGES = 200;

/** Salesforce の ID は英数字 15 文字か 18 文字 */
const SALESFORCE_ID_PATTERN = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

export function isSalesforceId(value: unknown): value is string {
  return typeof value === 'string' && SALESFORCE_ID_PATTERN.test(value);
}

/** 表の列を見分ける見出し（英語と日本語の画面）。大文字と小文字は区別しない */
type ColumnLabels = readonly string[];

export const CHANGE_SET_MARKERS = {
  /** 送信変更セットの詳細画面のパス（U1 の PAGE_MARKERS と同じ画面） */
  detailPath: '/changemgmt/outboundChangeSetDetailPage.apexp',
  /** 変更セットへのコンポーネントの追加画面のパス */
  addPath: '/p/mfpkg/AddToPackageFromChangeMgmtUi',
  idParam: 'id',
  /** 追加画面の種類の指定 */
  typeParam: 'entityType',
  /** 1 ページの件数を増やす指定と、その値（上限は B2 で確かめる） */
  rowsPerPageParam: 'rowsperpage',
  rowsPerPage: 1000,

  /** ページ送り（詳細画面・追加画面で共通） */
  paging: {
    /** 「次のページ」のリンク。最後のページでは href のないしるしになる */
    next: '.paginator a.next[href]',
    /** 全体の件数の表示 */
    totalCount: '.paginator .totalCount',
  },

  detail: {
    name: 'h2.pageDescription',
    /** 「アップロード」の操作があれば open（BR2.4） */
    uploadAction: 'input[name="upload"]',
    /** アップロード済みの表示か、アップロードの記録があれば uploaded（BR2.4） */
    uploadedNotice: '.uploadedNotice',
    uploadHistoryRows: '.uploadHistory table.list tr.dataRow',
    componentTable: {
      table: '.componentList table.list',
      headerCells: 'tr.headerRow > th',
      rows: 'tr.dataRow',
    } satisfies TableSpec,
    columns: {
      name: ['Name', '名前'],
      parentObject: ['Parent Object', '親オブジェクト'],
      type: ['Type', '種別', '種類'],
    } satisfies Record<string, ColumnLabels>,
  },

  add: {
    formSpec: {
      form: 'form#editPage',
      submit: 'input[type="submit"][name="save"]',
    } satisfies FormSpec,
    /** 種類の選択肢。表示名は詳細画面の種類の欄と同じと想定する（BR3.3。B2 で確かめる） */
    typeSelect: 'select[name="entityType"]',
    candidateTable: {
      table: 'form#editPage table.list',
      headerCells: 'tr.headerRow > th',
      rows: 'tr.dataRow',
      checkbox: 'input[type="checkbox"]',
    } satisfies TableSpec,
    columns: {
      name: ['Name', '名前'],
      parentObject: ['Parent Object', '親オブジェクト'],
    } satisfies Record<string, ColumnLabels>,
  },

  /** ログイン画面の見分け方（BR1.4） */
  login: {
    selectors: ['form#login_form', 'input[name="pw"]', 'input#password'],
    paths: ['/', '/login', '/secur/login_portal.jsp'],
  },

  /** 権限がない旨の画面と、対象のデータがない旨の画面の見分け方（BR1.4） */
  errorPage: {
    permissionSelectors: ['.insufficientPrivileges', '#insufficientPrivileges'],
    titleSelector: '.errorTitle',
    permissionTitles: ['Insufficient Privileges', '権限が不十分です'],
    notFoundTitles: ['Data Not Available', 'データを利用できません'],
  },
} as const;

/**
 * AppError の message に入れる固定の識別子（BR1.7、security-design.md §3）。
 * URL・名前・画面の中身は入れない。
 */
export const ERROR_MESSAGES = {
  invalidDestination: 'salesforce.invalidDestination',
  redirected: 'salesforce.redirected',
  loginPage: 'salesforce.loginPage',
  permissionDenied: 'salesforce.permissionDenied',
  notFoundPage: 'salesforce.notFound',
  unexpectedStatus: 'salesforce.unexpectedStatus',
  network: 'salesforce.network',
  timeout: 'salesforce.timeout',
  unexpectedError: 'salesforce.unexpectedError',
  invalidChangeSetId: 'changeset.invalidId',
  invalidRequest: 'changeset.invalidRequest',
  missingName: 'changeset.missingName',
  missingTable: 'changeset.missingTable',
  missingColumn: 'changeset.missingColumn',
  unexpectedRow: 'changeset.unexpectedRow',
  changeSetLocked: 'changeset.locked',
  missingAddForm: 'changeset.missingAddForm',
  missingTypeLabel: 'changeset.missingTypeLabel',
  missingSubmit: 'changeset.missingSubmit',
  candidateNotFound: 'changeset.candidateNotFound',
  addNotConfirmed: 'changeset.addNotConfirmed',
} as const;

/** 詳細画面の 1 ページ目のパス（1 ページの件数を増やす指定つき） */
export function detailPagePath(changeSetId: string): string {
  const params = new URLSearchParams({
    [CHANGE_SET_MARKERS.idParam]: changeSetId,
    [CHANGE_SET_MARKERS.rowsPerPageParam]: String(CHANGE_SET_MARKERS.rowsPerPage),
  });
  return `${CHANGE_SET_MARKERS.detailPath}?${params.toString()}`;
}

/** 追加画面の 1 ページ目のパス。種類を指定しないときは、Salesforce が最初に出す種類の画面になる */
export function addPagePath(changeSetId: string, componentType?: string): string {
  const params = new URLSearchParams({ [CHANGE_SET_MARKERS.idParam]: changeSetId });
  if (componentType) params.set(CHANGE_SET_MARKERS.typeParam, componentType);
  params.set(CHANGE_SET_MARKERS.rowsPerPageParam, String(CHANGE_SET_MARKERS.rowsPerPage));
  return `${CHANGE_SET_MARKERS.addPath}?${params.toString()}`;
}

/** 見出しの並びから、その列の位置を探す。なければ -1 */
export function findColumn(headers: readonly string[], labels: ColumnLabels): number {
  const wanted = labels.map((label) => label.toLowerCase());
  return headers.findIndex((header) => wanted.includes(header.toLowerCase()));
}

function pathnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/** ログイン画面か（ログインの入力欄があるか、ログイン画面のパスか） */
export function isLoginPage(page: ParsedPage, url: string | null = null): boolean {
  const pathname = pathnameOf(url);
  if (pathname !== null && CHANGE_SET_MARKERS.login.paths.some((path) => path === pathname)) {
    return true;
  }
  return CHANGE_SET_MARKERS.login.selectors.some((selector) => page.exists(selector));
}

function hasErrorTitle(page: ParsedPage, titles: readonly string[]): boolean {
  const title = page.text(CHANGE_SET_MARKERS.errorPage.titleSelector);
  if (title === null) return false;
  const lower = title.toLowerCase();
  return titles.some((candidate) => lower === candidate.toLowerCase());
}

/** 権限がない旨の画面か */
export function isPermissionDeniedPage(page: ParsedPage): boolean {
  const markers = CHANGE_SET_MARKERS.errorPage;
  return (
    markers.permissionSelectors.some((selector) => page.exists(selector)) ||
    hasErrorTitle(page, markers.permissionTitles)
  );
}

/** 対象のデータがない旨の画面か */
export function isNotFoundPage(page: ParsedPage): boolean {
  return hasErrorTitle(page, CHANGE_SET_MARKERS.errorPage.notFoundTitles);
}
