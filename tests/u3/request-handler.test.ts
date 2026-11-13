/**
 * ページ側の一覧の頼みの受け取り（src/changeset-viewer/request-handler.ts）。
 * U2 の listComponents は vi.mock で差し替え、実際の組織にはつながない。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListComponentsRequest } from '../../src/changeset';
import { listComponents } from '../../src/changeset';
import {
  createComponentsListener,
  registerChangesetViewerHandler,
} from '../../src/changeset-viewer/request-handler';
import { runSalesforceContent } from '../../entrypoints/salesforce.content';
import { CHANGESET_COMPONENTS_CHANNEL, CHANGESET_PROGRESS_CHANNEL } from '../../src/page/channels';
import type { PageInfo } from '../../src/page/page-context';
import { ok } from '../../src/shared/result';
import { dispatchRuntimeMessage, mockState } from '../u1/helpers/chrome-mock';
import {
  restoreFrame,
  setBodyHtml,
  setEmbeddedFrame,
  setFrameUrl,
  urls,
} from '../u1/fixtures/pages';
import { validSettings } from '../u1/fixtures/settings';
import { TEST_EXTENSION_ID, popupState, setRuntimeSendFailure } from './helpers/chrome-popup';
import { loadComponents } from './helpers/fixtures';

vi.mock('../../src/changeset', () => ({ listComponents: vi.fn() }));

const listComponentsMock = vi.mocked(listComponents);
const CHANGE_SET_ID = '0A2000000000001';
const OTHER_CHANGE_SET_ID = '0A2000000000002';

const detailPage: PageInfo = {
  url: `https://example.my.salesforce.com/changemgmt/outboundChangeSetDetailPage.apexp?id=${CHANGE_SET_ID}`,
  pageKind: 'outboundChangeSetDetail',
  changeSetId: CHANGE_SET_ID,
  orgHost: 'example.my.salesforce.com',
};

const request = (changeSetId = CHANGE_SET_ID) => ({
  channel: CHANGESET_COMPONENTS_CHANNEL,
  changeSetId,
});

describe('ページ側の受け取り（request-handler）', () => {
  beforeEach(() => {
    listComponentsMock.mockReset();
    listComponentsMock.mockResolvedValue(ok(loadComponents('components-basic')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('受け取りの確かめ: ほかの拡張機能・違う窓口・違う changeSetId には false で答えず、U2 を呼ばない', async () => {
    const listener = createComponentsListener(CHANGE_SET_ID);
    const sendResponse = vi.fn();
    const own = { id: TEST_EXTENSION_ID };

    expect(listener(request(), { id: 'other-extension' }, sendResponse)).toBe(false);
    expect(listener({ channel: 'sftoybox/page-info' }, own, sendResponse)).toBe(false);
    expect(listener({ channel: CHANGESET_COMPONENTS_CHANNEL }, own, sendResponse)).toBe(false);
    expect(listener(request(OTHER_CHANGE_SET_ID), own, sendResponse)).toBe(false);
    expect(listener(null, own, sendResponse)).toBe(false);
    // 詳細画面でないフレームには聞き手そのものがない
    await registerChangesetViewerHandler({ ...detailPage, pageKind: 'pageSizeList' });
    await expect(dispatchRuntimeMessage(request())).resolves.toBeUndefined();

    expect(listComponentsMock).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('すべて合うと true を返し、U2 の結果を sendResponse で 1 回だけ返す', async () => {
    const listener = createComponentsListener(CHANGE_SET_ID);
    const sendResponse = vi.fn();

    expect(listener(request(), { id: TEST_EXTENSION_ID }, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1));

    expect(sendResponse).toHaveBeenCalledWith(ok(loadComponents('components-basic')));
    expect(listComponentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ changeSetId: CHANGE_SET_ID }),
    );
    await Promise.resolve();
    expect(sendResponse).toHaveBeenCalledTimes(1);
  });

  it('進み具合: 1 ページごとに progress を送り、送信の失敗は無視して続ける（BR4.1、NFR7.2）', async () => {
    listComponentsMock.mockImplementation(async ({ onProgress }: ListComponentsRequest) => {
      onProgress?.({ loadedPages: 1, totalPages: 3 });
      setRuntimeSendFailure('lastError');
      onProgress?.({ loadedPages: 2, totalPages: 3 });
      setRuntimeSendFailure('throw');
      onProgress?.({ loadedPages: 3, totalPages: 3 });
      return ok(loadComponents('components-basic'));
    });
    const sendResponse = vi.fn();

    createComponentsListener(CHANGE_SET_ID)(request(), { id: TEST_EXTENSION_ID }, sendResponse);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1));

    expect(popupState().runtimeMessages).toEqual(
      [1, 2, 3].map((loadedPages) => ({
        channel: CHANGESET_PROGRESS_CHANNEL,
        changeSetId: CHANGE_SET_ID,
        progress: { loadedPages, totalPages: 3 },
      })),
    );
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(mockState().local.errorLog).toBeUndefined();
  });

  it('失敗を外に出さない: U2 が例外を投げても unexpectedResponse が返り、記録される（NFR5.1）', async () => {
    listComponentsMock.mockRejectedValue(new Error('TestChangeSet exploded'));
    const sendResponse = vi.fn();

    createComponentsListener(CHANGE_SET_ID)(request(), { id: TEST_EXTENSION_ID }, sendResponse);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1));

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: expect.objectContaining({ kind: 'unexpectedResponse' }),
    });
    await vi.waitFor(() =>
      expect(mockState().local.errorLog).toEqual([
        expect.objectContaining({
          toolId: 'changeset-viewer',
          kind: 'unexpectedResponse',
          messageKey: 'errorLog.viewerHandlerFailed',
        }),
      ]),
    );
  });

  it('OFF のとき: OFF なら登録しない。ON でも詳細画面でないフレームでは登録しない（NFR7.3）', async () => {
    mockState().local.settings = validSettings({ 'changeset-viewer': { enabled: false } });
    await expect(registerChangesetViewerHandler(detailPage)).resolves.toBe(false);
    expect(mockState().messageListeners).toHaveLength(0);

    mockState().local.settings = validSettings({ 'changeset-viewer': { enabled: true } });
    for (const pageKind of ['pageSizeList', 'outboundChangeSetAdd', 'other'] as const) {
      await expect(registerChangesetViewerHandler({ ...detailPage, pageKind })).resolves.toBe(
        false,
      );
    }
    await expect(
      registerChangesetViewerHandler({ ...detailPage, changeSetId: null }),
    ).resolves.toBe(false);
    expect(mockState().messageListeners).toHaveLength(0);

    await expect(registerChangesetViewerHandler(detailPage)).resolves.toBe(true);
    expect(mockState().messageListeners).toHaveLength(1);
  });

  it('記録の中身: 記録はツールの識別子・種類・文言の識別子だけで、名前を含まない（NFR1.3）', async () => {
    listComponentsMock.mockRejectedValue(new Error('TestChangeSet TestField__c'));
    const sendResponse = vi.fn();

    createComponentsListener(CHANGE_SET_ID)(request(), { id: TEST_EXTENSION_ID }, sendResponse);
    await vi.waitFor(() => expect(mockState().local.errorLog).toHaveLength(1));

    const [entry] = mockState().local.errorLog as Record<string, unknown>[];
    expect(Object.keys(entry ?? {}).sort()).toEqual(['at', 'kind', 'messageKey', 'toolId']);
    expect(JSON.stringify(mockState().local.errorLog)).not.toMatch(/TestChangeSet|TestField/);
  });

  it('onMessageExternal には登録しない（NFR3.3）', async () => {
    await registerChangesetViewerHandler(detailPage);

    expect(mockState().messageListeners).toHaveLength(1);
    expect(mockState().externalListeners).toHaveLength(0);
  });

  describe('入口（entrypoints/salesforce.content.ts）から', () => {
    beforeEach(() => {
      setEmbeddedFrame(true);
      setBodyHtml('<div>TestChangeSet</div>');
    });

    afterEach(() => {
      restoreFrame();
    });

    it('ON の詳細画面では登録され、ほかの画面では登録されない', async () => {
      setFrameUrl(urls.changeSetDetail15);
      await runSalesforceContent({ loadPageSizeBar: vi.fn() });
      // 画面の判定への応答（U1）と、一覧の受け取り（U3）
      expect(mockState().messageListeners).toHaveLength(2);
      const answer = await dispatchRuntimeMessage({
        channel: CHANGESET_COMPONENTS_CHANNEL,
        changeSetId: '0A2xx0000000001',
      });
      expect(answer).toMatchObject({ ok: true });

      mockState().messageListeners = [];
      setFrameUrl(urls.changeSetAdd);
      await runSalesforceContent({ loadPageSizeBar: vi.fn() });
      expect(mockState().messageListeners).toHaveLength(1);
    });
  });
});
