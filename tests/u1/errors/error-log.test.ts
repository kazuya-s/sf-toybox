import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_LOG_MAX_ENTRIES,
  clearErrors,
  getRecentErrors,
  recordError,
} from '../../../src/errors/error-log';
import { mockState, setStorageFailure } from '../helpers/chrome-mock';

describe('エラーの記録（error-log、security-design.md §5）', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('コンソールに [sf-toybox:<toolId>] を付けて、元の例外と一緒に出す', async () => {
    const cause = new Error('boom');

    await recordError(
      {
        toolId: 'page-size-switcher',
        kind: 'unexpected',
        messageKey: 'errorLog.pageSizeBarLoadFailed',
      },
      cause,
    );

    expect(console.error).toHaveBeenCalledWith(
      '[sf-toybox:page-size-switcher]',
      'unexpected',
      'errorLog.pageSizeBarLoadFailed',
      cause,
    );
  });

  it('保存される中身は決めた 4 項目だけで、例外の文章や URL は入らない', async () => {
    const cause = new Error('https://example.my.salesforce.com/01p?secret=Account-Name');

    await recordError(
      { toolId: 'core', kind: 'unexpected', messageKey: 'errorLog.pageDetectFailed' },
      cause,
    );

    const stored = mockState().local.errorLog as Record<string, unknown>[];
    expect(stored).toHaveLength(1);
    expect(Object.keys(stored[0] ?? {}).sort()).toEqual(['at', 'kind', 'messageKey', 'toolId']);
    expect(JSON.stringify(stored)).not.toContain('salesforce.com');
    expect(JSON.stringify(stored)).not.toContain('Account-Name');
    expect(new Date(String(stored[0]?.at)).toISOString()).toBe(stored[0]?.at);
  });

  it(`${ERROR_LOG_MAX_ENTRIES + 1} 件目を足すと一番古いものが消え、新しいものから並ぶ`, async () => {
    for (let index = 0; index <= ERROR_LOG_MAX_ENTRIES; index += 1) {
      await recordError({
        toolId: 'core',
        kind: 'unexpected',
        messageKey: `errorLog.test${index}`,
      });
    }

    const entries = await getRecentErrors();

    expect(entries).toHaveLength(ERROR_LOG_MAX_ENTRIES);
    expect(entries[0]?.messageKey).toBe(`errorLog.test${ERROR_LOG_MAX_ENTRIES}`);
    expect(entries.map((entry) => entry.messageKey)).not.toContain('errorLog.test0');
  });

  it('消去すると一覧が空になる', async () => {
    await recordError({
      toolId: 'core',
      kind: 'unexpected',
      messageKey: 'errorLog.pageDetectFailed',
    });

    const cleared = await clearErrors();

    expect(cleared.ok).toBe(true);
    expect(await getRecentErrors()).toEqual([]);
  });

  it.each(['lastError', 'throw'] as const)(
    '保存に失敗（%s）しても例外が外に出ず、コンソールにだけ出る',
    async (mode) => {
      setStorageFailure({ set: mode });

      await expect(
        recordError({
          toolId: 'core',
          kind: 'storageFailed',
          messageKey: 'errorLog.settingsSaveFailed',
        }),
      ).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        '[sf-toybox:core]',
        'errorLog の保存に失敗しました',
        'storageFailed',
      );
    },
  );

  it('読み出しに失敗すると空の一覧を返し、壊れた項目は除く', async () => {
    mockState().local.errorLog = [
      { toolId: 'core', kind: 'unexpected', at: '2026-11-12T00:00:00.000Z', messageKey: 'a' },
      { toolId: 'someone-else', kind: 'unexpected', at: 'x', messageKey: 'b' },
      'broken',
    ];
    expect((await getRecentErrors()).map((entry) => entry.messageKey)).toEqual(['a']);

    setStorageFailure({ get: 'lastError' });

    expect(await getRecentErrors()).toEqual([]);
  });
});
