/**
 * Requests from the popup (src/changeset-viewer/popup-client.ts).
 * chrome.tabs is the mock in tests/u3/helpers/chrome-popup.ts, switching between answer, delay, no answer and immediate failure.
 */
import { describe, expect, it, vi } from 'vitest';
import type { LoadProgress } from '../../src/changeset';
import {
  COMPONENTS_TIMEOUT_MS,
  PAGE_INFO_TIMEOUT_MS,
  askPageInfo,
  getActiveTabId,
  requestComponents,
} from '../../src/changeset-viewer/popup-client';
import { CHANGESET_COMPONENTS_CHANNEL, CHANGESET_PROGRESS_CHANNEL } from '../../src/page/channels';
import { PAGE_INFO_CHANNEL } from '../../src/page/page-info-responder';
import { fail, ok } from '../../src/shared/result';
import { mockState } from '../u1/helpers/chrome-mock';
import {
  ACTIVE_TAB_ID,
  emitToPopup,
  popupState,
  setActiveTabs,
  setTabMessageBehavior,
} from './helpers/chrome-popup';
import { loadComponents } from './helpers/fixtures';

const CHANGE_SET_ID = '0A2000000000001';
const detailInfo = {
  url: `https://example.my.salesforce.com/changemgmt/outboundChangeSetDetailPage.apexp?id=${CHANGE_SET_ID}`,
  pageKind: 'outboundChangeSetDetail',
  changeSetId: CHANGE_SET_ID,
  orgHost: 'example.my.salesforce.com',
};
const progressMessage = (loadedPages: number, changeSetId = CHANGE_SET_ID) => ({
  channel: CHANGESET_PROGRESS_CHANNEL,
  changeSetId,
  progress: { loadedPages, totalPages: 3 },
});

describe('Requests from the popup (popup-client)', () => {
  it('returns changeSetId from a detail page answer (BR1.2)', async () => {
    setTabMessageBehavior(PAGE_INFO_CHANNEL, { kind: 'respond', response: ok(detailInfo) });

    await expect(askPageInfo(ACTIVE_TAB_ID)).resolves.toEqual({
      kind: 'detail',
      changeSetId: CHANGE_SET_ID,
    });
    expect(popupState().tabMessages).toEqual([
      { tabId: ACTIVE_TAB_ID, message: { channel: PAGE_INFO_CHANNEL } },
    ]);
  });

  it('no answer (3 seconds), a send failure, a failed answer, not a detail page, or no changeSetId is wrong-page', async () => {
    vi.useFakeTimers();
    setTabMessageBehavior(PAGE_INFO_CHANNEL, { kind: 'silent' });
    const silent = askPageInfo(ACTIVE_TAB_ID);
    await vi.advanceTimersByTimeAsync(PAGE_INFO_TIMEOUT_MS - 1);
    let settled = false;
    void silent.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(silent).resolves.toEqual({ kind: 'wrong-page' });
    vi.useRealTimers();

    const answers: unknown[] = [
      fail('notFound', 'no page'),
      ok({ ...detailInfo, pageKind: 'pageSizeList' }),
      ok({ ...detailInfo, changeSetId: null }),
      'not-a-result',
    ];
    for (const response of answers) {
      setTabMessageBehavior(PAGE_INFO_CHANNEL, { kind: 'respond', response });
      await expect(askPageInfo(ACTIVE_TAB_ID)).resolves.toEqual({ kind: 'wrong-page' });
    }
    setTabMessageBehavior(PAGE_INFO_CHANNEL, { kind: 'fail' });
    await expect(askPageInfo(ACTIVE_TAB_ID)).resolves.toEqual({ kind: 'wrong-page' });
  });

  it('progress from another tab, another extension or another changeSetId is dropped (NFR7.2)', async () => {
    setTabMessageBehavior(CHANGESET_COMPONENTS_CHANNEL, { kind: 'silent' });
    const received: LoadProgress[] = [];
    vi.useFakeTimers();
    const pending = requestComponents(ACTIVE_TAB_ID, CHANGE_SET_ID, (p) => received.push(p));

    await emitToPopup(progressMessage(1));
    await emitToPopup(progressMessage(9), { tabId: ACTIVE_TAB_ID + 1 });
    await emitToPopup(progressMessage(9), { id: 'other-extension' });
    await emitToPopup(progressMessage(9, '0A2000000000002'));
    await emitToPopup({
      channel: CHANGESET_PROGRESS_CHANNEL,
      changeSetId: CHANGE_SET_ID,
      progress: 'x',
    });
    await emitToPopup(progressMessage(2));

    expect(received).toEqual([
      { loadedPages: 1, totalPages: 3 },
      { loadedPages: 2, totalPages: 3 },
    ]);
    await vi.advanceTimersByTimeAsync(COMPONENTS_TIMEOUT_MS);
    await pending;
  });

  it('an immediate send failure is error (notFound); no response in 5 minutes is error (timeout) (BR1.4)', async () => {
    setTabMessageBehavior(CHANGESET_COMPONENTS_CHANNEL, { kind: 'fail' });
    await expect(
      requestComponents(ACTIVE_TAB_ID, CHANGE_SET_ID, () => undefined),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'notFound' } });

    vi.useFakeTimers();
    setTabMessageBehavior(CHANGESET_COMPONENTS_CHANNEL, { kind: 'silent' });
    const pending = requestComponents(ACTIVE_TAB_ID, CHANGE_SET_ID, () => undefined);
    await vi.advanceTimersByTimeAsync(COMPONENTS_TIMEOUT_MS);
    await expect(pending).resolves.toMatchObject({ ok: false, error: { kind: 'timeout' } });
    vi.useRealTimers();

    setTabMessageBehavior(CHANGESET_COMPONENTS_CHANNEL, {
      kind: 'respond',
      response: { ok: 'maybe' },
    });
    await expect(
      requestComponents(ACTIVE_TAB_ID, CHANGE_SET_ID, () => undefined),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'unexpectedResponse' } });
    setTabMessageBehavior(CHANGESET_COMPONENTS_CHANNEL, {
      kind: 'respond',
      response: fail('sessionExpired', 'login'),
    });
    await expect(
      requestComponents(ACTIVE_TAB_ID, CHANGE_SET_ID, () => undefined),
    ).resolves.toMatchObject({ ok: false, error: { kind: 'sessionExpired' } });
  });

  it('removes the listener when done and returns the list result as is', async () => {
    const result = ok(loadComponents('components-basic'));
    setTabMessageBehavior(CHANGESET_COMPONENTS_CHANNEL, {
      kind: 'respond',
      response: result,
      delayMs: 10,
    });

    const pending = requestComponents(ACTIVE_TAB_ID, CHANGE_SET_ID, () => undefined);
    expect(mockState().messageListeners).toHaveLength(1);

    await expect(pending).resolves.toEqual(result);
    expect(mockState().messageListeners).toHaveLength(0);
    expect(popupState().tabMessages.at(-1)?.message).toEqual({
      channel: CHANGESET_COMPONENTS_CHANNEL,
      changeSetId: CHANGE_SET_ID,
    });
  });

  it('never uses the tab URL (only the id from tabs.query); null when there is no tab', async () => {
    const tab = { id: ACTIVE_TAB_ID, active: true };
    const urlGetter = vi.fn(() => 'https://example.my.salesforce.com/');
    Object.defineProperty(tab, 'url', { get: urlGetter });
    popupState().activeTabs = [tab as chrome.tabs.Tab];

    await expect(getActiveTabId()).resolves.toBe(ACTIVE_TAB_ID);
    expect(urlGetter).not.toHaveBeenCalled();
    expect(popupState().queryInfos).toEqual([{ active: true, currentWindow: true }]);

    setActiveTabs([]);
    await expect(getActiveTabId()).resolves.toBeNull();
  });
});
