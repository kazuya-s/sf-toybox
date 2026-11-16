/**
 * Page (frame) detection (PageContextApi.detect of C3 in contract-summary.md, BR2.1-BR2.5).
 * No network; detects from the frame's URL and document only (NFR7.3).
 */

export type PageKind =
  'pageSizeList' | 'outboundChangeSetDetail' | 'outboundChangeSetAdd' | 'other';

export type PageInfo = {
  url: string;
  pageKind: PageKind;
  /** Only on change set pages */
  changeSetId: string | null;
  /** Host name of the detected frame itself (BR2.5) */
  orgHost: string;
};

/**
 * Page markers (BR2.3, BR2.4).
 * If manual checks (B1: Apex class list etc.; B2: change set pages) show the real pages differ, fix only this.
 */
export const PAGE_MARKERS = {
  /** Name of the page-size parameter */
  rowsPerPageParam: 'rowsperpage',
  /** Pager of classic-style lists ("Next Page", "Previous Page", etc.) */
  paginationSelectors: ['.paginator', '.pShowMore'],
  /** List table the page-size bar is placed above */
  listTableSelectors: ['table.list', '.listViewport'],
  /** Path of the outbound change set detail page */
  changeSetDetailPaths: ['/changemgmt/outboundChangeSetDetailPage.apexp'],
  /** Path of the page for adding components to a change set */
  changeSetAddPaths: ['/p/mfpkg/AddToPackageFromChangeMgmtUi'],
  /** Path prefix of Lightning Experience pages */
  lightningPathPrefix: '/lightning/',
} as const;

/** Salesforce IDs are 15 or 18 alphanumeric characters (BR2.4) */
const SALESFORCE_ID_PATTERN = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

function matchesPath(pathname: string, paths: readonly string[]): boolean {
  const lower = pathname.toLowerCase();
  return paths.some((path) => lower === path.toLowerCase());
}

/** Whether this is the top-level frame. Never reads the top page's content; only compares with itself (BR2.2) */
function isTopFrame(doc: Document): boolean {
  const view = doc.defaultView;
  if (!view) return true;
  try {
    return view.top === view;
  } catch {
    // If they cannot be compared, assume it is embedded
    return false;
  }
}

function hasRowsPerPageParam(url: URL): boolean {
  return url.searchParams.has(PAGE_MARKERS.rowsPerPageParam);
}

/** Pager sign: a link containing rowsperpage, or a row of pager links (BR2.3) */
function hasPaginationMarker(doc: Document): boolean {
  const pattern = new RegExp(`[?&]${PAGE_MARKERS.rowsPerPageParam}=`, 'i');
  const links = Array.from(doc.querySelectorAll('a[href]'));
  if (links.some((link) => pattern.test(link.getAttribute('href') ?? ''))) return true;
  return PAGE_MARKERS.paginationSelectors.some((selector) => doc.querySelector(selector) !== null);
}

function changeSetKind(url: URL): PageKind | null {
  if (matchesPath(url.pathname, PAGE_MARKERS.changeSetDetailPaths))
    return 'outboundChangeSetDetail';
  if (matchesPath(url.pathname, PAGE_MARKERS.changeSetAddPaths)) return 'outboundChangeSetAdd';
  return null;
}

function info(url: URL, pageKind: PageKind, changeSetId: string | null = null): PageInfo {
  return { url: url.href, pageKind, changeSetId, orgHost: url.hostname };
}

/** Detects this frame. Pages used after switching to Classic are other (FR5.3) */
export function detect({ url, document: doc }: { url: string; document: Document }): PageInfo {
  const parsed = new URL(url);
  if (parsed.pathname.startsWith(PAGE_MARKERS.lightningPathPrefix)) return info(parsed, 'other');
  if (isTopFrame(doc)) return info(parsed, 'other');

  const changeSet = changeSetKind(parsed);
  if (changeSet) {
    const id = parsed.searchParams.get('id');
    return id && SALESFORCE_ID_PATTERN.test(id)
      ? info(parsed, changeSet, id)
      : info(parsed, 'other');
  }

  if (hasRowsPerPageParam(parsed) || hasPaginationMarker(doc)) return info(parsed, 'pageSizeList');
  return info(parsed, 'other');
}
