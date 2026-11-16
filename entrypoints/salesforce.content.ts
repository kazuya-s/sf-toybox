/**
 * Entry that runs in every frame of a Salesforce page (performance-design.md §1, §4; functional-spec.md F3).
 * Order: detect -> register responder -> stop if other -> ON/OFF -> stop if OFF -> load the page-size bar -> render.
 * This entry never loads React and never makes network requests (NFR7.3).
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startChangesetAddAssist } from '../src/changeset-add-assist/load';
import { registerChangesetViewerHandler } from '../src/changeset-viewer/request-handler';
import { recordError } from '../src/errors/error-log';
import { detect } from '../src/page/page-context';
import { registerPageInfoResponder } from '../src/page/page-info-responder';
import { isEnabled } from '../src/settings/tool-settings';
import { SALESFORCE_MATCHES } from '../src/shared/salesforce-matches';
import type { PageSizeBarModule } from './page-size-bar';

/** Built page-size bar file (listed in web_accessible_resources) */
export const PAGE_SIZE_BAR_PATH = '/page-size-bar.js';

export type ContentEntryDeps = {
  /** Loads the page-size bar. Replaced in tests */
  loadPageSizeBar?: () => Promise<PageSizeBarModule>;
};

/** Loads the page-size bar bundled with the extension. Never loads from an external URL (NFR3.1) */
async function loadBundledPageSizeBar(): Promise<PageSizeBarModule> {
  const module = (await import(/* @vite-ignore */ chrome.runtime.getURL(PAGE_SIZE_BAR_PATH))) as {
    default?: Partial<PageSizeBarModule>;
  };
  const mountPageSizeBar = module.default?.mountPageSizeBar;
  if (typeof mountPageSizeBar !== 'function') {
    throw new TypeError('page-size-bar.js does not provide mountPageSizeBar');
  }
  return { mountPageSizeBar };
}

/** Entry logic. Exceptions never escape; they are logged (NFR5.1, BR4.3) */
export async function runSalesforceContent(deps: ContentEntryDeps = {}): Promise<void> {
  const loadPageSizeBar = deps.loadPageSizeBar ?? loadBundledPageSizeBar;
  try {
    // Detect and register the responder first, regardless of ON/OFF (BR2.6)
    const pageInfo = registerPageInfoResponder(() =>
      detect({ url: window.location.href, document }),
    );
    // U3: register the list-request handler only on an outbound change set detail page with the tool ON (errors are logged inside)
    if (pageInfo) await registerChangesetViewerHandler(pageInfo);
    if (!pageInfo || pageInfo.pageKind === 'other') return;
    // U4: lazily load the add-assist widget only on the "Add" page with the tool ON (errors are logged inside)
    if (pageInfo.pageKind === 'outboundChangeSetAdd')
      return await startChangesetAddAssist(pageInfo);

    // ON/OFF is read once when the page loads (BR1.7). If it cannot be read, treat it as ON (NFR5.2)
    if (!(await isEnabled({ toolId: 'page-size-switcher' }))) return;
    if (pageInfo.pageKind !== 'pageSizeList') return;

    let barModule: PageSizeBarModule;
    try {
      barModule = await loadPageSizeBar();
    } catch (error) {
      await recordError(
        {
          toolId: 'page-size-switcher',
          kind: 'unexpected',
          messageKey: 'errorLog.pageSizeBarLoadFailed',
        },
        error,
      );
      return;
    }
    barModule.mountPageSizeBar(pageInfo);
  } catch (error) {
    await recordError(
      {
        toolId: 'page-size-switcher',
        kind: 'unexpected',
        messageKey: 'errorLog.contentEntryFailed',
      },
      error,
    );
  }
}

export default defineContentScript({
  matches: [...SALESFORCE_MATCHES],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    void runSalesforceContent();
  },
});
