/**
 * 画面（フレーム）の判定（contract-summary.md C3 の PageContextApi.detect、BR2.1〜BR2.5）。
 * 通信はせず、そのフレームの URL と文書の中身だけで判定する（NFR7.3）。
 */

export type PageKind =
  'pageSizeList' | 'outboundChangeSetDetail' | 'outboundChangeSetAdd' | 'other';

export type PageInfo = {
  url: string;
  pageKind: PageKind;
  /** 変更セットの画面のときだけ */
  changeSetId: string | null;
  /** 判定したフレーム自身のホスト名（BR2.5） */
  orgHost: string;
};

/**
 * 画面の目印の定義（BR2.3、BR2.4）。
 * 手での確認（B1: Apex クラスの一覧など、B2: 変更セットの画面）で実際の画面と違っていたら、ここだけを直す。
 */
export const PAGE_MARKERS = {
  /** 件数のパラメータの名前 */
  rowsPerPageParam: 'rowsperpage',
  /** 古い形式の一覧のページ送り（「次のページ」「前のページ」など）の並び */
  paginationSelectors: ['.paginator', '.pShowMore'],
  /** 件数バーを置く一覧の表 */
  listTableSelectors: ['table.list', '.listViewport'],
  /** 送信変更セットの詳細画面のパス */
  changeSetDetailPaths: ['/changemgmt/outboundChangeSetDetailPage.apexp'],
  /** 変更セットへのコンポーネントの追加画面のパス */
  changeSetAddPaths: ['/p/mfpkg/AddToPackageFromChangeMgmtUi'],
  /** Lightning Experience の画面のパスの始まり */
  lightningPathPrefix: '/lightning/',
} as const;

/** Salesforce の ID は英数字 15 文字か 18 文字（BR2.4） */
const SALESFORCE_ID_PATTERN = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

function matchesPath(pathname: string, paths: readonly string[]): boolean {
  const lower = pathname.toLowerCase();
  return paths.some((path) => lower === path.toLowerCase());
}

/** 自分が最上位のフレームか。最上位の画面の中身は読まず、自分と比べるだけにする（BR2.2） */
function isTopFrame(doc: Document): boolean {
  const view = doc.defaultView;
  if (!view) return true;
  try {
    return view.top === view;
  } catch {
    // 比べられないときは埋め込まれているとみなす
    return false;
  }
}

function hasRowsPerPageParam(url: URL): boolean {
  return url.searchParams.has(PAGE_MARKERS.rowsPerPageParam);
}

/** ページ送りのしるし: rowsperpage を含むリンクか、ページ送りのリンクの並び（BR2.3） */
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

/** そのフレームを判定する。Classic に切り替えて使っている画面は other（FR5.3） */
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
