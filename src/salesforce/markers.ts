/**
 * Markers for reading pages (functional-design/rules.md BR1.5).
 *
 * The detail and Add page HTML structure are initial values to be confirmed in the B2 manual check (docs/manual-check.md).
 * If they do not match the real pages, fix only this file.
 */
import type { FormSpec, ParsedPage, TableSpec } from './types';

/** Time until a single request times out (BR1.3) */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Maximum pages read in one load (BR2.2) */
export const MAX_PAGES = 200;

/** Salesforce IDs are 15 or 18 alphanumeric characters */
const SALESFORCE_ID_PATTERN = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

export function isSalesforceId(value: unknown): value is string {
  return typeof value === 'string' && SALESFORCE_ID_PATTERN.test(value);
}

/** Column headings that identify table columns (English and Japanese UI). Case-insensitive */
type ColumnLabels = readonly string[];

export const CHANGE_SET_MARKERS = {
  /** Path of the outbound change set detail page (same page as U1's PAGE_MARKERS) */
  detailPath: '/changemgmt/outboundChangeSetDetailPage.apexp',
  /** Path of the page for adding components to a change set */
  addPath: '/p/mfpkg/AddToPackageFromChangeMgmtUi',
  idParam: 'id',
  /** Type parameter on the Add page */
  typeParam: 'entityType',
  /** Parameter that increases rows per page, and its value (the maximum is checked in B2) */
  rowsPerPageParam: 'rowsperpage',
  rowsPerPage: 1000,

  /** Pager (shared by the detail and Add pages) */
  paging: {
    /** "Next Page" link. On the last page it is a marker without href */
    next: '.paginator a.next[href]',
    /** Total count text */
    totalCount: '.paginator .totalCount',
  },

  detail: {
    name: 'h2.pageDescription',
    /** open if there is an "Upload" action (BR2.4) */
    uploadAction: 'input[name="upload"]',
    /** uploaded if there is an uploaded notice or an upload record (BR2.4) */
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
    /** Type options. Labels are assumed to match the detail page's type column (BR3.3; checked in B2) */
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

  /** How to recognize the login page (BR1.4) */
  login: {
    selectors: ['form#login_form', 'input[name="pw"]', 'input#password'],
    paths: ['/', '/login', '/secur/login_portal.jsp'],
  },

  /** How to recognize the insufficient-privileges and data-not-available pages (BR1.4) */
  errorPage: {
    permissionSelectors: ['.insufficientPrivileges', '#insufficientPrivileges'],
    titleSelector: '.errorTitle',
    permissionTitles: ['Insufficient Privileges', '権限が不十分です'],
    notFoundTitles: ['Data Not Available', 'データを利用できません'],
  },
} as const;

/**
 * Fixed IDs put in AppError.message (BR1.7, security-design.md §3).
 * Never includes URLs, names or page content.
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

/** Path of page 1 of the detail page (with the parameter that increases rows per page) */
export function detailPagePath(changeSetId: string): string {
  const params = new URLSearchParams({
    [CHANGE_SET_MARKERS.idParam]: changeSetId,
    [CHANGE_SET_MARKERS.rowsPerPageParam]: String(CHANGE_SET_MARKERS.rowsPerPage),
  });
  return `${CHANGE_SET_MARKERS.detailPath}?${params.toString()}`;
}

/** Path of page 1 of the Add page. Without a type, it is whichever type Salesforce shows first */
export function addPagePath(changeSetId: string, componentType?: string): string {
  const params = new URLSearchParams({ [CHANGE_SET_MARKERS.idParam]: changeSetId });
  if (componentType) params.set(CHANGE_SET_MARKERS.typeParam, componentType);
  params.set(CHANGE_SET_MARKERS.rowsPerPageParam, String(CHANGE_SET_MARKERS.rowsPerPage));
  return `${CHANGE_SET_MARKERS.addPath}?${params.toString()}`;
}

/** Finds the column index from the header row; -1 if missing */
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

/** Whether this is the login page (has the login inputs, or is on the login path) */
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

/** Whether this is the insufficient-privileges page */
export function isPermissionDeniedPage(page: ParsedPage): boolean {
  const markers = CHANGE_SET_MARKERS.errorPage;
  return (
    markers.permissionSelectors.some((selector) => page.exists(selector)) ||
    hasErrorTitle(page, markers.permissionTitles)
  );
}

/** Whether this is the data-not-available page */
export function isNotFoundPage(page: ParsedPage): boolean {
  return hasErrorTitle(page, CHANGE_SET_MARKERS.errorPage.notFoundTitles);
}
