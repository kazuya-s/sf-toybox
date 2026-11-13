/**
 * Salesforce の画面の各フレームで動く入口（performance-design.md §1・§4、functional-spec.md F3）。
 * 順番: 判定 → 応答の登録 → other なら終わり → ON/OFF → OFF なら終わり → 件数バーの部品の読み込み → 表示。
 * この入口は React を読み込まない。通信もしない（NFR7.3）。
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

/** ビルドした件数バーの部品のファイル（web_accessible_resources に載せる） */
export const PAGE_SIZE_BAR_PATH = '/page-size-bar.js';

export type ContentEntryDeps = {
  /** 件数バーの部品を読み込む。テストで差し替える */
  loadPageSizeBar?: () => Promise<PageSizeBarModule>;
};

/** 拡張機能に同梱した件数バーの部品を読み込む。外部の URL からは読み込まない（NFR3.1） */
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

/** 入口の処理。例外は外に出さず、記録する（NFR5.1、BR4.3） */
export async function runSalesforceContent(deps: ContentEntryDeps = {}): Promise<void> {
  const loadPageSizeBar = deps.loadPageSizeBar ?? loadBundledPageSizeBar;
  try {
    // ON/OFF に関係なく、判定と応答の登録を先に行う（BR2.6）
    const pageInfo = registerPageInfoResponder(() =>
      detect({ url: window.location.href, document }),
    );
    // U3: ON の送信変更セットの詳細画面だけ、一覧の頼みの受け取りを登録する（例外は中で記録する）
    if (pageInfo) await registerChangesetViewerHandler(pageInfo);
    if (!pageInfo || pageInfo.pageKind === 'other') return;
    // U4: ON で「追加」画面のときだけ、追加支援の部品を後から読み込む（例外は中で記録する）
    if (pageInfo.pageKind === 'outboundChangeSetAdd')
      return await startChangesetAddAssist(pageInfo);

    // ON/OFF は画面の読み込み時に 1 回だけ読む（BR1.7）。読めなければ ON（NFR5.2）
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
