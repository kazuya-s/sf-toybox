/**
 * Example page URLs and HTML (unit-test-instructions.md "Test data").
 * HTML is parsed with DOMParser and inserted into the document (innerHTML is not used).
 */

export const ORG_HOST = 'example.my.salesforce.com';
const ORIGIN = `https://${ORG_HOST}`;

export const urls = {
  /** Apex class list (with rowsperpage) */
  listWithRowsPerPage: `${ORIGIN}/01p?setupid=ApexClasses&rowsperpage=500&retURL=%2Fsetup`,
  /** Apex class list (without rowsperpage) */
  listWithoutRowsPerPage: `${ORIGIN}/01p?setupid=ApexClasses`,
  /** Outbound change set detail page (15- and 18-character IDs) */
  changeSetDetail15: `${ORIGIN}/changemgmt/outboundChangeSetDetailPage.apexp?id=0A2xx0000000001`,
  changeSetDetail18: `${ORIGIN}/changemgmt/outboundChangeSetDetailPage.apexp?id=0A2xx0000000001AAA`,
  /** Page for adding to a change set */
  changeSetAdd: `${ORIGIN}/p/mfpkg/AddToPackageFromChangeMgmtUi?id=0A2xx0000000001AAA`,
  /** Change set page with a malformed ID */
  changeSetBadId: `${ORIGIN}/changemgmt/outboundChangeSetDetailPage.apexp?id=0A2xx-<script>`,
  changeSetNoId: `${ORIGIN}/p/mfpkg/AddToPackageFromChangeMgmtUi`,
  /** Lightning Experience page */
  lightning: `${ORIGIN}/lightning/setup/ApexClasses/home`,
  /** Page with no markers */
  plain: `${ORIGIN}/setup/forcecomHomepage.apexp`,
} as const;

export const html = {
  /** Classic-style list with pager links */
  listWithPagination: `
    <div class="bPageBlock">
      <table class="list"><tr><th>名前</th></tr><tr><td>MyClass</td></tr></table>
      <div class="paginator"><a href="/01p?lsi=25">次のページ</a></div>
    </div>`,
  /** List with a page-size link */
  listWithRowsPerPageLink: `
    <table class="list"><tr><td>MyClass</td></tr></table>
    <a href="/01p?setupid=ApexClasses&amp;rowsperpage=100">表示件数を増やす</a>`,
  /** List without a table (pager only) */
  paginationWithoutTable: `<div class="pShowMore"><a href="/01p?lsi=25">次</a></div>`,
  /** Page with no markers */
  plain: `<h1>ホーム</h1><p>しるしはありません</p>`,
} as const;

/** Replaces the current document body with example HTML */
export function setBodyHtml(source: string): void {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const nodes = Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true));
  document.body.replaceChildren(...nodes);
}

/** Changes this frame's URL (a happy-dom feature; history.replaceState cannot change origin) */
export function setFrameUrl(url: string): void {
  (window as unknown as { happyDOM: { setURL: (value: string) => void } }).happyDOM.setURL(url);
}

const originalTop = Object.getOwnPropertyDescriptor(window, 'top');

/** Makes this frame embedded in another page (true) or top-level (false) */
export function setEmbeddedFrame(embedded: boolean): void {
  const fakeTop = embedded ? ({} as Window) : window;
  Object.defineProperty(window, 'top', { configurable: true, get: () => fakeTop });
}

export function restoreFrame(): void {
  if (originalTop) Object.defineProperty(window, 'top', originalTop);
  else delete (window as unknown as Record<string, unknown>).top;
}
