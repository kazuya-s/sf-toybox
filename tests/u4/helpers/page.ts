/**
 * 「追加」画面の文書の例と、画面のテストの道具。
 * HTML は DOMParser で読み、文書に差し込む（innerHTML は使わない）。
 * 架空の値だけを使う（ホスト名は example.my.salesforce.com、ID は 0 の並び）。
 */
import { act } from '@testing-library/react';
import { TEST_CHANGE_SET_ID, TEST_COMPONENT_TYPE, TEST_ORG_HOST } from './fixtures';

export const ADD_PAGE_URL = `https://${TEST_ORG_HOST}/p/mfpkg/AddToPackageFromChangeMgmtUi?id=${TEST_CHANGE_SET_ID}`;
export const DETAIL_PAGE_URL = `https://${TEST_ORG_HOST}/changemgmt/outboundChangeSetDetailPage.apexp?id=${TEST_CHANGE_SET_ID}`;

/** 種類の選択欄と候補の表がある「追加」画面 */
export const addPageHtml = (componentType: string = TEST_COMPONENT_TYPE) => `
  <form id="editPage" action="/p/mfpkg/AddToPackageFromChangeMgmtUi">
    <select name="entityType">
      <option value="ApexClass">Apex Class</option>
      <option value="${componentType}" selected>Custom Field</option>
    </select>
    <input type="submit" name="save" value="Add">
    <table class="list"><tr class="headerRow"><th>Name</th></tr></table>
  </form>`;

/** 種類の選択欄のない「追加」画面 */
export const addPageWithoutTypeHtml = `
  <form id="editPage"><table class="list"><tr class="headerRow"><th>Name</th></tr></table></form>`;

export function setBody(source: string): void {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  document.body.replaceChildren(
    ...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)),
  );
}

/** React の更新と、たまっている Promise の続きを流す */
export async function settle(times = 10): Promise<void> {
  await act(async () => {
    for (let index = 0; index < times; index += 1) await Promise.resolve();
  });
}
