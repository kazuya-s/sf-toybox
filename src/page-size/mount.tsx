/**
 * Mounts the page-size bar into Salesforce pages (mountWithSlds of C2 in contract-summary.md, BR4.2, BR4.3).
 * Puts the bundled SLDS and the bar inside a Shadow DOM so they never clash with the Salesforce page's styles.
 */
import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import sldsCss from '../../assets/slds.css?inline';
import { recordError } from '../errors/error-log';
import { PAGE_MARKERS, type PageInfo } from '../page/page-context';
import { PageSizeBar } from './PageSizeBar';

/** Marker on the page-size bar host element. Used to show only one per frame */
export const PAGE_SIZE_BAR_HOST_ATTRIBUTE = 'data-sftoybox-page-size-bar';

/** :root does not match inside a Shadow DOM, so rewrite it to :host */
export function toShadowCss(css: string): string {
  return css.replace(/:root\b/g, ':host');
}

/** Creates a Shadow DOM on host and returns a container with the bundled SLDS applied */
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

/** A render error never breaks the Salesforce page; the bar is simply not shown (BR4.3) */
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
 * Shows the page-size bar right above the list table, or at the top of the body if there is no table.
 * If it is already shown, returns the existing host without adding another. Does nothing outside list pages.
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
