/**
 * ページ側の一覧の頼みの受け取り（rules.md BR4.1、security-design.md §4・§6、performance-design.md §2・§3）。
 * - changeset-viewer が ON で、このフレームが送信変更セットの詳細画面のときだけ登録する（NFR7.3）
 * - 自分の拡張機能から、決めた窓口で、このフレームの changeSetId の頼みにだけ答える（NFR3.3）
 * - U2 の listComponents の結果をそのまま 1 回だけ返す。進み具合はそのつど送る
 * - 例外は外に出さず、unexpectedResponse の結果を返して記録する（NFR5.1）
 * - onMessageExternal は登録しない
 *
 * ページ側の入口に入るため、src/changeset-viewer/ui/ と export.ts は読み込まない
 * （React を入口に入れない。infrastructure-specification.md「大きさ」）。
 */
import { listComponents, type ChangeSetComponents, type LoadProgress } from '../changeset';
import { recordError } from '../errors/error-log';
import { CHANGESET_COMPONENTS_CHANNEL, CHANGESET_PROGRESS_CHANNEL } from '../page/channels';
import type { PageInfo } from '../page/page-context';
import { isEnabled } from '../settings/tool-settings';
import { fail, type Result } from '../shared/result';

/** ツールバーの画面からの一覧の頼み（C4） */
export type ComponentsRequest = {
  channel: typeof CHANGESET_COMPONENTS_CHANNEL;
  changeSetId: string;
};

/** ツールバーの画面へ送る進み具合（C4 の progress） */
export type ProgressMessage = {
  channel: typeof CHANGESET_PROGRESS_CHANNEL;
  changeSetId: string;
  progress: LoadProgress;
};

export type ComponentsResponse = Result<ChangeSetComponents>;

function isComponentsRequest(message: unknown): message is ComponentsRequest {
  if (typeof message !== 'object' || message === null) return false;
  const request = message as Partial<ComponentsRequest>;
  return (
    request.channel === CHANGESET_COMPONENTS_CHANNEL && typeof request.changeSetId === 'string'
  );
}

/**
 * 進み具合を送る。ツールバーの画面が閉じていて送れないときの失敗は無視する（記録もしない。BR4.1）。
 * lastError はコールバックの中で読み、Chrome の「確かめていないエラー」の警告を出さない。
 */
function sendProgress(changeSetId: string, progress: LoadProgress): void {
  const message: ProgressMessage = { channel: CHANGESET_PROGRESS_CHANNEL, changeSetId, progress };
  try {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // 拡張機能が更新された直後などで送れないときも、読み込みは止めない（BR4.1）
  }
}

async function respond(
  changeSetId: string,
  sendResponse: (response: ComponentsResponse) => void,
): Promise<void> {
  let response: ComponentsResponse;
  try {
    response = await listComponents({
      changeSetId,
      onProgress: (progress) => sendProgress(changeSetId, progress),
    });
  } catch (error) {
    await recordError(
      {
        toolId: 'changeset-viewer',
        kind: 'unexpectedResponse',
        messageKey: 'errorLog.viewerHandlerFailed',
      },
      error,
    );
    response = fail('unexpectedResponse', 'changeset request handler failed');
  }
  try {
    sendResponse(response);
  } catch (error) {
    // ツールバーの画面が閉じて応答の窓口がなくなったとき。コンソールにだけ出す
    console.error('[sf-toybox:changeset-viewer]', 'sendResponse failed', error);
  }
}

/** このフレームの changeSetId の頼みにだけ答える聞き手を作る */
export function createComponentsListener(changeSetId: string) {
  return (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ComponentsResponse) => void,
  ): boolean => {
    if (sender.id !== chrome.runtime.id) return false;
    if (!isComponentsRequest(message)) return false;
    if (message.changeSetId !== changeSetId) return false;
    void respond(changeSetId, sendResponse);
    // 非同期で答えるので、応答の窓口を開けたままにする
    return true;
  };
}

/**
 * ON で、送信変更セットの詳細画面のフレームのときだけ、受け取りの処理を登録する。
 * 登録したら true。例外は外に出さず記録する。
 */
export async function registerChangesetViewerHandler(pageInfo: PageInfo): Promise<boolean> {
  try {
    if (pageInfo.pageKind !== 'outboundChangeSetDetail' || !pageInfo.changeSetId) return false;
    if (!(await isEnabled({ toolId: 'changeset-viewer' }))) return false;
    chrome.runtime.onMessage.addListener(createComponentsListener(pageInfo.changeSetId));
    return true;
  } catch (error) {
    await recordError(
      {
        toolId: 'changeset-viewer',
        kind: 'unexpected',
        messageKey: 'errorLog.viewerHandlerFailed',
      },
      error,
    );
    return false;
  }
}
