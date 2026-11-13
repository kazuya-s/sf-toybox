/**
 * Salesforce の画面への件数バーの組み込み（contract-summary.md C2 の mountWithSlds、BR4.2、BR4.3）。
 * Shadow DOM の中に、同梱の SLDS と件数バーを置き、Salesforce の画面のスタイルとぶつからないようにする。
 */
import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import sldsCss from '../../assets/slds.css?inline';
import { recordError } from '../errors/error-log';
import { PAGE_MARKERS, type PageInfo } from '../page/page-context';
import { PageSizeBar } from './PageSizeBar';

/** 件数バーの入れ物に付ける目印。1 つのフレームに 1 つだけ出すために使う */
export const PAGE_SIZE_BAR_HOST_ATTRIBUTE = 'data-sftoybox-page-size-bar';

/** Shadow DOM の中では :root が当たらないため、:host に置き換える */
export function toShadowCss(css: string): string {
  return css.replace(/:root\b/g, ':host');
}

/** host に Shadow DOM を作り、同梱の SLDS を当てた入れ物を返す */
export function mountWithSlds(host: Element): { root: Element } {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const style = host.ownerDocument.createElement('style');
  style.textContent = toShadowCss(sldsCss);
  const root = host.ownerDocument.createElement('div');
  root.className = 'sftoybox-root';
  shadow.replaceChildren(style, root);
  return { root };
}

type BoundaryProps = { children: ReactNode };
type BoundaryState = { hasFailed: boolean };

/** 表示中のエラーでも Salesforce の画面を壊さず、件数バーを出さないだけにする（BR4.3） */
class PageSizeBarBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasFailed: true };
  }

  override componentDidCatch(error: unknown): void {
    void recordError(
      {
        toolId: 'page-size-switcher',
        kind: 'unexpected',
        messageKey: 'errorLog.pageSizeBarRenderFailed',
      },
      error,
    );
  }

  override render(): ReactNode {
    return this.state.hasFailed ? null : this.props.children;
  }
}

function findListTable(doc: Document): Element | null {
  for (const selector of PAGE_MARKERS.listTableSelectors) {
    const found = doc.querySelector(selector);
    if (found) return found;
  }
  return null;
}

/**
 * 一覧の表のすぐ上に件数バーを出す。表がなければ本文の先頭に出す。
 * すでに出ていれば足さずに、その入れ物を返す。一覧の画面でなければ何もしない。
 */
export function mountPageSizeBar(pageInfo: PageInfo, doc: Document = document): Element | null {
  if (pageInfo.pageKind !== 'pageSizeList') return null;
  const existing = doc.querySelector(`[${PAGE_SIZE_BAR_HOST_ATTRIBUTE}]`);
  if (existing) return existing;

  const host = doc.createElement('div');
  host.setAttribute(PAGE_SIZE_BAR_HOST_ATTRIBUTE, '');
  host.setAttribute('data-testid', 'page-size-bar-host');
  const table = findListTable(doc);
  if (table?.parentNode) table.parentNode.insertBefore(host, table);
  else doc.body.prepend(host);

  const { root } = mountWithSlds(host);
  createRoot(root).render(
    <PageSizeBarBoundary>
      <PageSizeBar href={pageInfo.url} />
    </PageSizeBarBoundary>,
  );
  return host;
}
