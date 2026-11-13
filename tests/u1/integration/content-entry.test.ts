/**
 * 入口（entrypoints/salesforce.content.ts）の結合テスト。
 * 本物の判定・応答・設定・エラーの記録を、chrome の模擬と件数バーの読み込みの差し替えでつないで動かす。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSalesforceContent } from '../../../entrypoints/salesforce.content';
import type { PageSizeBarModule } from '../../../entrypoints/page-size-bar';
import { PAGE_INFO_CHANNEL } from '../../../src/page/page-info-responder';
import { dispatchRuntimeMessage, mockState, setStorageFailure } from '../helpers/chrome-mock';
import {
  html,
  restoreFrame,
  setBodyHtml,
  setEmbeddedFrame,
  setFrameUrl,
  urls,
} from '../fixtures/pages';
import { validSettings } from '../fixtures/settings';

function fakeBarModule() {
  const mountPageSizeBar = vi.fn<PageSizeBarModule['mountPageSizeBar']>(() => null);
  const loadPageSizeBar = vi.fn(async (): Promise<PageSizeBarModule> => ({ mountPageSizeBar }));
  return { mountPageSizeBar, loadPageSizeBar };
}

describe('入口の流れ（content-entry）', () => {
  const originalFetch = globalThis.fetch;
  const originalXhr = globalThis.XMLHttpRequest;
  const fetchSpy = vi.fn(() => {
    throw new Error('network is not allowed');
  });
  const xhrSpy = vi.fn(() => {
    throw new Error('network is not allowed');
  });

  beforeEach(() => {
    setFrameUrl(urls.listWithRowsPerPage);
    setEmbeddedFrame(true);
    setBodyHtml(html.listWithPagination);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchSpy.mockClear();
    xhrSpy.mockClear();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    globalThis.XMLHttpRequest = xhrSpy as unknown as typeof XMLHttpRequest;
  });

  afterEach(() => {
    restoreFrame();
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXhr;
  });

  it('ON の一覧画面では件数バーを読み込んで表示し、応答も登録する（AC2.1.1）', async () => {
    const bar = fakeBarModule();

    await runSalesforceContent({ loadPageSizeBar: bar.loadPageSizeBar });

    expect(bar.loadPageSizeBar).toHaveBeenCalledTimes(1);
    expect(bar.mountPageSizeBar).toHaveBeenCalledWith(
      expect.objectContaining({ pageKind: 'pageSizeList', url: urls.listWithRowsPerPage }),
    );
    expect(mockState().messageListeners).toHaveLength(1);
  });

  it('OFF では件数バーの部品を読み込まないが、応答は登録する（NFR7.2、AC1.1.4、BR2.6）', async () => {
    mockState().local.settings = validSettings({ 'page-size-switcher': { enabled: false } });
    const bar = fakeBarModule();

    await runSalesforceContent({ loadPageSizeBar: bar.loadPageSizeBar });

    expect(bar.loadPageSizeBar).not.toHaveBeenCalled();
    expect(mockState().messageListeners).toHaveLength(1);
  });

  it('other の画面では読み込まず、応答も登録しない', async () => {
    setFrameUrl(urls.plain);
    setBodyHtml(html.plain);
    const bar = fakeBarModule();

    await runSalesforceContent({ loadPageSizeBar: bar.loadPageSizeBar });

    expect(bar.loadPageSizeBar).not.toHaveBeenCalled();
    expect(mockState().messageListeners).toHaveLength(0);
    expect(mockState().localGetCalls).toBe(0);
  });

  it('設定が読めないときは ON として表示し、エラーを記録する（NFR5.2）', async () => {
    setStorageFailure({ get: 'lastError' });
    const bar = fakeBarModule();

    await runSalesforceContent({ loadPageSizeBar: bar.loadPageSizeBar });

    expect(bar.mountPageSizeBar).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      '[sf-toybox:core]',
      'storageFailed',
      'errorLog.settingsLoadFailed',
    );
  });

  it('読み込みに失敗しても例外が外に出ず、記録され、応答は残る（NFR5.1）', async () => {
    const loadPageSizeBar = vi.fn(async (): Promise<PageSizeBarModule> => {
      throw new Error('failed to load page-size-bar.js');
    });

    await expect(runSalesforceContent({ loadPageSizeBar })).resolves.toBeUndefined();

    expect(mockState().local.errorLog).toEqual([
      expect.objectContaining({
        toolId: 'page-size-switcher',
        kind: 'unexpected',
        messageKey: 'errorLog.pageSizeBarLoadFailed',
      }),
    ]);
    vi.useFakeTimers();
    const answer = dispatchRuntimeMessage({ channel: PAGE_INFO_CHANNEL });
    await vi.advanceTimersByTimeAsync(200);
    await expect(answer).resolves.toMatchObject({ ok: true, value: { pageKind: 'pageSizeList' } });
  });

  it('表示で例外が出ても外に出さず記録し、判定より前にも後にも通信をしない（NFR7.3）', async () => {
    const mountPageSizeBar = vi.fn(() => {
      throw new Error('mount failed');
    });

    await runSalesforceContent({ loadPageSizeBar: async () => ({ mountPageSizeBar }) });

    expect(mountPageSizeBar).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      '[sf-toybox:page-size-switcher]',
      'unexpected',
      'errorLog.contentEntryFailed',
      expect.any(Error),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });
});
