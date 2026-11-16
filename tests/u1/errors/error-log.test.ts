import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_LOG_MAX_ENTRIES,
  clearErrors,
  getRecentErrors,
  recordError,
} from '../../../src/errors/error-log';
import { mockState, setStorageFailure } from '../helpers/chrome-mock';

describe('Error log (error-log, security-design.md §5)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('writes to the console prefixed with [sf-toybox:<toolId>], together with the original exception', async () => {
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

  it('stores only the four chosen fields, never exception text or URLs', async () => {
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

  it(`adding entry ${ERROR_LOG_MAX_ENTRIES + 1} drops the oldest and lists newest first`, async () => {
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

  it('clearing empties the list', async () => {
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
    'a save failure (%s) never throws and goes only to the console',
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
        'Failed to save errorLog',
        'storageFailed',
      );
    },
  );

  it('returns an empty list when reading fails, and drops broken entries', async () => {
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
