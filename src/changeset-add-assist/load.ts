/**
 * Loads and mounts the add-assist widget from the entry (entrypoints/salesforce.content.ts)
 * (U4 performance-design.md §2, BR1.1, cicd-pipeline.md stage 6).
 *
 * This code is part of the entry, so it never imports React, U2 or state.ts.
 * Only when the tool is ON on the "Add" page, it loads the bundled widget with import(chrome.runtime.getURL(...)).
 * Never loads from an external URL. Exceptions never escape; they are logged (NFR5.1). The page-size bar is unaffected.
 */
import type { ChangesetAddAssistModule } from '../../entrypoints/changeset-add-assist';
import { recordError } from '../errors/error-log';
import type { PageInfo } from '../page/page-context';
import { isEnabled } from '../settings/tool-settings';

/** Built add-assist widget file (listed in web_accessible_resources) */
export const CHANGESET_ADD_ASSIST_PATH = '/changeset-add-assist.js';

const TOOL_ID = 'changeset-add-assist';

/** Loads the add-assist widget bundled with the extension */
export async function loadBundledChangesetAddAssist(): Promise<ChangesetAddAssistModule> {
  const module = (await import(
    /* @vite-ignore */ chrome.runtime.getURL(CHANGESET_ADD_ASSIST_PATH)
  )) as { default?: Partial<ChangesetAddAssistModule> };
  const mountChangesetAddAssist = module.default?.mountChangesetAddAssist;
  if (typeof mountChangesetAddAssist !== 'function') {
    throw new TypeError('changeset-add-assist.js does not provide mountChangesetAddAssist');
  }
  return { mountChangesetAddAssist };
}

/**
 * On the "Add" page, loads and mounts the widget only when the tool is ON (BR1.1).
 * ON/OFF is read once when the page loads. If it cannot be read, it is treated as ON (U1 isEnabled).
 */
export async function startChangesetAddAssist(
  pageInfo: PageInfo,
  load: () => Promise<ChangesetAddAssistModule> = loadBundledChangesetAddAssist,
): Promise<void> {
  if (pageInfo.pageKind !== 'outboundChangeSetAdd') return;
  try {
    if (!(await isEnabled({ toolId: TOOL_ID }))) return;
    let addAssist: ChangesetAddAssistModule;
    try {
      addAssist = await load();
    } catch (error) {
      await recordError(
        { toolId: TOOL_ID, kind: 'unexpected', messageKey: 'errorLog.addAssistLoadFailed' },
        error,
      );
      return;
    }
    addAssist.mountChangesetAddAssist(pageInfo);
  } catch (error) {
    await recordError(
      { toolId: TOOL_ID, kind: 'unexpected', messageKey: 'errorLog.addAssistMountFailed' },
      error,
    );
  }
}
