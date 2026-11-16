/**
 * Entry of the lazily loaded page-size bar (performance-design.md §1).
 * It contains React and SLDS, so it is built as a file separate from the entry (salesforce.content.ts)
 * and loaded with import(chrome.runtime.getURL('/page-size-bar.js')) only when the tool is ON on a list page.
 * wxt.config.ts emits it as an ES module; the default export exposes mountPageSizeBar.
 */
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { mountPageSizeBar } from '../src/page-size/mount';

export type PageSizeBarModule = {
  mountPageSizeBar: typeof mountPageSizeBar;
};

export default defineUnlistedScript((): PageSizeBarModule => ({ mountPageSizeBar }));
