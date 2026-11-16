/**
 * Page-side handler for component list requests (rules.md BR4.1, security-design.md §4, §6, performance-design.md §2, §3).
 * - Registered only when changeset-viewer is ON and this frame is an outbound change set detail page (NFR7.3)
 * - Answers only requests from this extension, on the agreed channel, for this frame's changeSetId (NFR3.3)
 * - Returns U2's listComponents result as is, exactly once. Sends progress as it goes
 * - Exceptions never escape; it returns an unexpectedResponse result and logs it (NFR5.1)
 * - Never registers onMessageExternal
 *
 * It is part of the page-side entry, so it never imports src/changeset-viewer/ui/ or export.ts
 * (keeps React out of the entry; infrastructure-specification.md, "Size").
 */
import { listComponents, type ChangeSetComponents, type LoadProgress } from '../changeset';
import { recordError } from '../errors/error-log';
import { CHANGESET_COMPONENTS_CHANNEL, CHANGESET_PROGRESS_CHANNEL } from '../page/channels';
import type { PageInfo } from '../page/page-context';
import { isEnabled } from '../settings/tool-settings';
import { fail, type Result } from '../shared/result';

/** Component list request from the toolbar popup (C4) */
export type ComponentsRequest = {
  channel: typeof CHANGESET_COMPONENTS_CHANNEL;
  changeSetId: string;
};

/** Progress sent to the toolbar popup (C4 progress) */
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
 * Sends progress. Failures because the popup is closed are ignored (not logged either; BR4.1).
 * lastError is read inside the callback so Chrome does not warn about an unchecked error.
 */
function sendProgress(changeSetId: string, progress: LoadProgress): void {
  const message: ProgressMessage = { channel: CHANGESET_PROGRESS_CHANNEL, changeSetId, progress };
  try {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // Loading continues even when sending fails, e.g. right after the extension was updated (BR4.1)
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
    // The popup closed and the response channel is gone. Console only
    console.error('[sf-toybox:changeset-viewer]', 'sendResponse failed', error);
  }
}

/** Creates a listener that answers only requests for this frame's changeSetId */
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
    // Answering asynchronously, so keep the response channel open
    return true;
  };
}

/**
 * Registers the handler only when the tool is ON and the frame is an outbound change set detail page.
 * Returns true if registered. Exceptions never escape; they are logged.
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
