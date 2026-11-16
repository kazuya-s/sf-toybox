import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageInfo, PageKind } from '../../../src/page/page-context';
import {
  PAGE_INFO_CHANNEL,
  RESPONSE_DELAY_MS,
  registerPageInfoResponder,
} from '../../../src/page/page-info-responder';
import { TEST_EXTENSION_ID, dispatchRuntimeMessage, mockState } from '../helpers/chrome-mock';
import { ORG_HOST, urls } from '../fixtures/pages';

function pageInfo(pageKind: PageKind, changeSetId: string | null = null): PageInfo {
  return { url: urls.listWithRowsPerPage, pageKind, changeSetId, orgHost: ORG_HOST };
}

const request = { channel: PAGE_INFO_CHANNEL };

describe('Answering the popup (page-info-responder, C3, BR2.6, NFR3.5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('answers queries from this extension with Result<PageInfo>', async () => {
    const info = pageInfo('outboundChangeSetDetail', '0A2xx0000000001AAA');
    registerPageInfoResponder(() => info);

    const answer = dispatchRuntimeMessage(request, { id: TEST_EXTENSION_ID });
    await vi.advanceTimersByTimeAsync(0);

    await expect(answer).resolves.toEqual({ ok: true, value: info });
    expect(mockState().externalListeners).toEqual([]);
  });

  it('does not answer other sender.id values', async () => {
    registerPageInfoResponder(() => pageInfo('pageSizeList'));

    const answer = dispatchRuntimeMessage(request, { id: 'another-extension' });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(answer).resolves.toBeUndefined();
  });

  it.each([{ channel: 'sftoybox/other' }, { type: PAGE_INFO_CHANNEL }, 'sftoybox/page-info', null])(
    'does not answer channels other than the agreed one (%j)',
    async (message) => {
      registerPageInfoResponder(() => pageInfo('pageSizeList'));

      const answer = dispatchRuntimeMessage(message);
      await vi.advanceTimersByTimeAsync(1000);

      await expect(answer).resolves.toBeUndefined();
    },
  );

  it('frames detected as other register nothing and never answer', async () => {
    const result = registerPageInfoResponder(() => pageInfo('other'));

    const answer = dispatchRuntimeMessage(request);
    await vi.advanceTimersByTimeAsync(1000);

    expect(result?.pageKind).toBe('other');
    expect(mockState().messageListeners).toHaveLength(0);
    await expect(answer).resolves.toBeUndefined();
  });

  it.each([
    ['outboundChangeSetDetail', 0],
    ['outboundChangeSetAdd', 100],
    ['pageSizeList', 200],
  ] as const)('delays the answer by priority: %s waits %d ms', async (pageKind, delay) => {
    expect(RESPONSE_DELAY_MS[pageKind]).toBe(delay);
    registerPageInfoResponder(() => pageInfo(pageKind));
    let answered = false;

    void dispatchRuntimeMessage(request).then(() => {
      answered = true;
    });
    if (delay > 0) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(answered).toBe(false);
    }
    await vi.advanceTimersByTimeAsync(1);

    expect(answered).toBe(true);
  });

  it('a detection error never throws, is logged, and nothing is registered', () => {
    const result = registerPageInfoResponder(() => {
      throw new Error('detect failed');
    });

    expect(result).toBeNull();
    expect(mockState().messageListeners).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith(
      '[sf-toybox:core]',
      'unexpected',
      'errorLog.pageDetectFailed',
      expect.any(Error),
    );
  });
});
