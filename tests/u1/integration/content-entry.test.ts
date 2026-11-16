/**
 * Integration test of the entry (entrypoints/salesforce.content.ts).
 * Runs the real detection, responder, settings and error log, wired with the chrome mock and a stubbed bar loader.
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

describe('Entry flow (content-entry)', () => {
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

  it('on a list page with the tool ON, loads and shows the bar and registers the responder (AC2.1.1)', async () => {
    const bar = fakeBarModule();

    await runSalesforceContent({ loadPageSizeBar: bar.loadPageSizeBar });

    expect(bar.loadPageSizeBar).toHaveBeenCalledTimes(1);
    expect(bar.mountPageSizeBar).toHaveBeenCalledWith(
      expect.objectContaining({ pageKind: 'pageSizeList', url: urls.listWithRowsPerPage }),
    );
    expect(mockState().messageListeners).toHaveLength(1);
  });

  it('when OFF, does not load the bar but still registers the responder (NFR7.2, AC1.1.4, BR2.6)', async () => {
    mockState().local.settings = validSettings({ 'page-size-switcher': { enabled: false } });
    const bar = fakeBarModule();

    await runSalesforceContent({ loadPageSizeBar: bar.loadPageSizeBar });

    expect(bar.loadPageSizeBar).not.toHaveBeenCalled();
    expect(mockState().messageListeners).toHaveLength(1);
  });

  it('on an other page, loads nothing and registers no responder', async () => {
    setFrameUrl(urls.plain);
    setBodyHtml(html.plain);
    const bar = fakeBarModule();

    await runSalesforceContent({ loadPageSizeBar: bar.loadPageSizeBar });

    expect(bar.loadPageSizeBar).not.toHaveBeenCalled();
    expect(mockState().messageListeners).toHaveLength(0);
    expect(mockState().localGetCalls).toBe(0);
  });

  it('when settings cannot be read, shows the bar as ON and logs an error (NFR5.2)', async () => {
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

  it('a load failure never throws, is logged, and the responder stays (NFR5.1)', async () => {
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

  it('a render exception never escapes and is logged; no network before or after detection (NFR7.3)', async () => {
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
