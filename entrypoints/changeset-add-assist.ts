/**
 * 後から読み込む追加支援の部品の入口（U4 performance-design.md §2、cicd-pipeline.md 段階 6）。
 * React・SLDS・U2 を含むため、入口（salesforce.content.ts）とは別のファイルにビルドし、
 * ツールが ON で「追加」画面のときだけ import(chrome.runtime.getURL('/changeset-add-assist.js')) で読み込む。
 * wxt.config.ts で ES モジュールとして出力し、既定の書き出し（default）で mountChangesetAddAssist を外に出す。
 */
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { mountChangesetAddAssist } from '../src/changeset-add-assist/mount';

export type ChangesetAddAssistModule = {
  mountChangesetAddAssist: typeof mountChangesetAddAssist;
};

export default defineUnlistedScript((): ChangesetAddAssistModule => ({ mountChangesetAddAssist }));
