/**
 * 画面の URL と HTML の例（unit-test-instructions.md「テストのデータ」）。
 * HTML は DOMParser で読み、文書に差し込む（innerHTML は使わない）。
 */

export const ORG_HOST = 'example.my.salesforce.com';
const ORIGIN = `https://${ORG_HOST}`;

export const urls = {
  /** Apex クラスの一覧（rowsperpage あり） */
  listWithRowsPerPage: `${ORIGIN}/01p?setupid=ApexClasses&rowsperpage=500&retURL=%2Fsetup`,
  /** Apex クラスの一覧（rowsperpage なし） */
  listWithoutRowsPerPage: `${ORIGIN}/01p?setupid=ApexClasses`,
  /** 送信変更セットの詳細画面（15 文字と 18 文字の ID） */
  changeSetDetail15: `${ORIGIN}/changemgmt/outboundChangeSetDetailPage.apexp?id=0A2xx0000000001`,
  changeSetDetail18: `${ORIGIN}/changemgmt/outboundChangeSetDetailPage.apexp?id=0A2xx0000000001AAA`,
  /** 変更セットへの追加画面 */
  changeSetAdd: `${ORIGIN}/p/mfpkg/AddToPackageFromChangeMgmtUi?id=0A2xx0000000001AAA`,
  /** ID の形が正しくない変更セットの画面 */
  changeSetBadId: `${ORIGIN}/changemgmt/outboundChangeSetDetailPage.apexp?id=0A2xx-<script>`,
  changeSetNoId: `${ORIGIN}/p/mfpkg/AddToPackageFromChangeMgmtUi`,
  /** Lightning Experience の画面 */
  lightning: `${ORIGIN}/lightning/setup/ApexClasses/home`,
  /** しるしのない画面 */
  plain: `${ORIGIN}/setup/forcecomHomepage.apexp`,
} as const;

export const html = {
  /** ページ送りのリンクがある古い形式の一覧 */
  listWithPagination: `
    <div class="bPageBlock">
      <table class="list"><tr><th>名前</th></tr><tr><td>MyClass</td></tr></table>
      <div class="paginator"><a href="/01p?lsi=25">次のページ</a></div>
    </div>`,
  /** 件数の切り替えリンクがある一覧 */
  listWithRowsPerPageLink: `
    <table class="list"><tr><td>MyClass</td></tr></table>
    <a href="/01p?setupid=ApexClasses&amp;rowsperpage=100">表示件数を増やす</a>`,
  /** 表のない一覧（ページ送りだけ） */
  paginationWithoutTable: `<div class="pShowMore"><a href="/01p?lsi=25">次</a></div>`,
  /** しるしのない画面 */
  plain: `<h1>ホーム</h1><p>しるしはありません</p>`,
} as const;

/** 今の文書の body を、HTML の例で置き換える */
export function setBodyHtml(source: string): void {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const nodes = Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true));
  document.body.replaceChildren(...nodes);
}

/** このフレームの URL を変える（happy-dom の機能。別オリジンへの history.replaceState はできないため） */
export function setFrameUrl(url: string): void {
  (window as unknown as { happyDOM: { setURL: (value: string) => void } }).happyDOM.setURL(url);
}

const originalTop = Object.getOwnPropertyDescriptor(window, 'top');

/** このフレームを、ほかの画面に埋め込まれたフレーム（true）か最上位（false）にする */
export function setEmbeddedFrame(embedded: boolean): void {
  const fakeTop = embedded ? ({} as Window) : window;
  Object.defineProperty(window, 'top', { configurable: true, get: () => fakeTop });
}

export function restoreFrame(): void {
  if (originalTop) Object.defineProperty(window, 'top', originalTop);
  else delete (window as unknown as Record<string, unknown>).top;
}
