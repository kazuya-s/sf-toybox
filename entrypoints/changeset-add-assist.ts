/**
 * Entry of the lazily loaded add-assist widget (U4 performance-design.md §2, cicd-pipeline.md stage 6).
 * It contains React, SLDS and U2, so it is built as a file separate from the entry (salesforce.content.ts)
 * and loaded with import(chrome.runtime.getURL('/changeset-add-assist.js')) only when the tool is ON on the "Add" page.
 * wxt.config.ts emits it as an ES module; the default export exposes mountChangesetAddAssist.
 */
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { mountChangesetAddAssist } from '../src/changeset-add-assist/mount';

export type ChangesetAddAssistModule = {
  mountChangesetAddAssist: typeof mountChangesetAddAssist;
};

export default defineUnlistedScript((): ChangesetAddAssistModule => ({ mountChangesetAddAssist }));
