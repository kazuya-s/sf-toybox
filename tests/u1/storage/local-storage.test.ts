import { describe, expect, it } from 'vitest';
import { readLocal, writeLocal } from '../../../src/storage/local-storage';
import { mockState, setStorageFailure } from '../helpers/chrome-mock';

describe('Local storage gateway (local-storage)', () => {
  it('calls only local, never sync (NFR1.2, BR1.1)', async () => {
    await writeLocal('settings', { schemaVersion: 1, tools: {} });
    await readLocal('settings');

    expect(mockState().localSetCalls).toHaveLength(1);
    expect(mockState().localGetCalls).toBe(1);
    expect(mockState().syncCalls).toEqual([]);
  });

  it.each(['lastError', 'throw'] as const)(
    'a read failure (%s) returns storageFailed',
    async (mode) => {
      setStorageFailure({ get: mode });

      const result = await readLocal('settings');

      expect(result).toMatchObject({ ok: false, error: { kind: 'storageFailed' } });
    },
  );

  it.each(['lastError', 'throw'] as const)(
    'a write failure (%s) returns storageFailed and leaves the value unchanged',
    async (mode) => {
      setStorageFailure({ set: mode });

      const result = await writeLocal('settings', { schemaVersion: 1, tools: {} });

      expect(result).toMatchObject({ ok: false, error: { kind: 'storageFailed' } });
      expect(mockState().local).toEqual({});
    },
  );

  it('returns ok with undefined when there is no value', async () => {
    const result = await readLocal('settings');

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('reads back exactly what was written', async () => {
    const value = { schemaVersion: 1, tools: { 'page-size-switcher': { enabled: false } } };

    const written = await writeLocal('settings', value);
    const read = await readLocal('settings');

    expect(written.ok).toBe(true);
    expect(read).toEqual({ ok: true, value });
  });
});
