/**
 * 後から読み込む件数バーの部品の入口（performance-design.md §1）。
 * React と SLDS を含むため、入口（salesforce.content.ts）とは別のファイルにビルドし、
 * ツールが ON で一覧の画面のときだけ import(chrome.runtime.getURL('/page-size-bar.js')) で読み込む。
 * wxt.config.ts で ES モジュールとして出力し、既定の書き出し（default）で mountPageSizeBar を外に出す。
 */
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { mountPageSizeBar } from '../src/page-size/mount';

export type PageSizeBarModule = {
  mountPageSizeBar: typeof mountPageSizeBar;
};

export default defineUnlistedScript((): PageSizeBarModule => ({ mountPageSizeBar }));
