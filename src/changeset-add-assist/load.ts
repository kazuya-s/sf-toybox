/**
 * 入口（entrypoints/salesforce.content.ts）から追加支援の部品を読み込んで置く処理
 * （U4 performance-design.md §2、BR1.1、cicd-pipeline.md 段階 6）。
 *
 * この処理は入口に入るので、React・U2・state.ts を読み込まない。
 * ツールが ON で「追加」画面のときだけ、拡張機能に同梱した部品を import(chrome.runtime.getURL(...)) で読み込む。
 * 外部の URL からは読み込まない。例外は外に出さず、記録する（NFR5.1）。件数バーの処理には影響しない。
 */
import type { ChangesetAddAssistModule } from '../../entrypoints/changeset-add-assist';
import { recordError } from '../errors/error-log';
import type { PageInfo } from '../page/page-context';
import { isEnabled } from '../settings/tool-settings';

/** ビルドした追加支援の部品のファイル（web_accessible_resources に載せる） */
export const CHANGESET_ADD_ASSIST_PATH = '/changeset-add-assist.js';

const TOOL_ID = 'changeset-add-assist';

/** 拡張機能に同梱した追加支援の部品を読み込む */
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
 * 「追加」画面で、ツールが ON のときだけ部品を読み込んで置く（BR1.1）。
 * ON/OFF は画面の読み込み時に 1 回だけ読む。読めなければ ON（U1 の isEnabled）。
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
