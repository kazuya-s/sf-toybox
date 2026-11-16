/**
 * Example "Add" page documents and UI test helpers.
 * HTML is parsed with DOMParser and inserted into the document (innerHTML is not used).
 * Uses only fake values (host example.my.salesforce.com, IDs all zeros).
 */
import { act } from '@testing-library/react';
import { TEST_CHANGE_SET_ID, TEST_COMPONENT_TYPE, TEST_ORG_HOST } from './fixtures';

export const ADD_PAGE_URL = `https://${TEST_ORG_HOST}/p/mfpkg/AddToPackageFromChangeMgmtUi?id=${TEST_CHANGE_SET_ID}`;
export const DETAIL_PAGE_URL = `https://${TEST_ORG_HOST}/changemgmt/outboundChangeSetDetailPage.apexp?id=${TEST_CHANGE_SET_ID}`;

/** "Add" page with a type select and a candidate table */
export const addPageHtml = (componentType: string = TEST_COMPONENT_TYPE) => `
  <form id="editPage" action="/p/mfpkg/AddToPackageFromChangeMgmtUi">
    <select name="entityType">
      <option value="ApexClass">Apex Class</option>
      <option value="${componentType}" selected>Custom Field</option>
    </select>
    <input type="submit" name="save" value="Add">
    <table class="list"><tr class="headerRow"><th>Name</th></tr></table>
  </form>`;

/** "Add" page without a type select */
export const addPageWithoutTypeHtml = `
  <form id="editPage"><table class="list"><tr class="headerRow"><th>Name</th></tr></table></form>`;

export function setBody(source: string): void {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  document.body.replaceChildren(
    ...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)),
  );
}

/** Flushes React updates and pending promise continuations */
export async function settle(times = 10): Promise<void> {
  await act(async () => {
    for (let index = 0; index < times; index += 1) await Promise.resolve();
  });
}
