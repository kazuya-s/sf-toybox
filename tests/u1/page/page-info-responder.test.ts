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

describe('ポップアップへの応答（page-info-responder、C3・BR2.6・NFR3.5）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('自分の拡張機能からの問い合わせに Result<PageInfo> を答える', async () => {
    const info = pageInfo('outboundChangeSetDetail', '0A2xx0000000001AAA');
    registerPageInfoResponder(() => info);

    const answer = dispatchRuntimeMessage(request, { id: TEST_EXTENSION_ID });
    await vi.advanceTimersByTimeAsync(0);

    await expect(answer).resolves.toEqual({ ok: true, value: info });
    expect(mockState().externalListeners).toEqual([]);
  });

  it('ほかの sender.id には答えない', async () => {
    registerPageInfoResponder(() => pageInfo('pageSizeList'));

    const answer = dispatchRuntimeMessage(request, { id: 'another-extension' });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(answer).resolves.toBeUndefined();
  });

  it.each([{ channel: 'sftoybox/other' }, { type: PAGE_INFO_CHANNEL }, 'sftoybox/page-info', null])(
    '決めた channel 以外（%j）には答えない',
    async (message) => {
      registerPageInfoResponder(() => pageInfo('pageSizeList'));

      const answer = dispatchRuntimeMessage(message);
      await vi.advanceTimersByTimeAsync(1000);

      await expect(answer).resolves.toBeUndefined();
    },
  );

  it('判定が other のフレームは登録せず、答えない', async () => {
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
  ] as const)('優先度に応じて答えを遅らせる: %s は %d ミリ秒', async (pageKind, delay) => {
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

  it('判定でエラーが出ても例外が外に出ず、記録され、登録もしない', () => {
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
