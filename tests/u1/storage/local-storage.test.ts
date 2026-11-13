import { describe, expect, it } from 'vitest';
import { readLocal, writeLocal } from '../../../src/storage/local-storage';
import { mockState, setStorageFailure } from '../helpers/chrome-mock';

describe('ローカル保存領域の窓口（local-storage）', () => {
  it('local だけを呼び、sync は呼ばない（NFR1.2、BR1.1）', async () => {
    await writeLocal('settings', { schemaVersion: 1, tools: {} });
    await readLocal('settings');

    expect(mockState().localSetCalls).toHaveLength(1);
    expect(mockState().localGetCalls).toBe(1);
    expect(mockState().syncCalls).toEqual([]);
  });

  it.each(['lastError', 'throw'] as const)(
    '読み出しの失敗（%s）は storageFailed で返す',
    async (mode) => {
      setStorageFailure({ get: mode });

      const result = await readLocal('settings');

      expect(result).toMatchObject({ ok: false, error: { kind: 'storageFailed' } });
    },
  );

  it.each(['lastError', 'throw'] as const)(
    '書き込みの失敗（%s）は storageFailed で返し、値は変わらない',
    async (mode) => {
      setStorageFailure({ set: mode });

      const result = await writeLocal('settings', { schemaVersion: 1, tools: {} });

      expect(result).toMatchObject({ ok: false, error: { kind: 'storageFailed' } });
      expect(mockState().local).toEqual({});
    },
  );

  it('値がないときは ok で undefined を返す', async () => {
    const result = await readLocal('settings');

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('書いた値をそのまま読める', async () => {
    const value = { schemaVersion: 1, tools: { 'page-size-switcher': { enabled: false } } };

    const written = await writeLocal('settings', value);
    const read = await readLocal('settings');

    expect(written.ok).toBe(true);
    expect(read).toEqual({ ok: true, value });
  });
});
