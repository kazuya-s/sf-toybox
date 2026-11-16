import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAll, isEnabled, setEnabled } from '../../../src/settings/tool-settings';
import { mockState, setStorageFailure } from '../helpers/chrome-mock';
import { validSettings } from '../fixtures/settings';

describe('Tool ON/OFF (tool-settings, C1)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('first run (nothing stored) is all ON (AC1.1.2)', async () => {
    const all = await getAll();

    expect(all.loadFailed).toBe(false);
    expect(all.settings.length).toBeGreaterThan(0);
    expect(all.settings.every((item) => item.enabled)).toBe(true);
  });

  it('saving OFF keeps it OFF after reloading (AC1.1.1)', async () => {
    const saved = await setEnabled({ toolId: 'page-size-switcher', enabled: false });

    expect(saved.ok).toBe(true);
    expect(await isEnabled({ toolId: 'page-size-switcher' })).toBe(false);
    expect((await getAll()).settings).toContainEqual({
      toolId: 'page-size-switcher',
      enabled: false,
    });
  });

  it('a load failure is all ON with loadFailed and logs an error (AC1.1.5, BR1.3)', async () => {
    setStorageFailure({ get: 'lastError' });

    const all = await getAll();

    expect(all.loadFailed).toBe(true);
    expect(all.settings.every((item) => item.enabled)).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      '[sf-toybox:core]',
      'storageFailed',
      'errorLog.settingsLoadFailed',
    );
  });

  it('a save failure returns storageFailed (BR1.5)', async () => {
    setStorageFailure({ set: 'lastError' });

    const saved = await setEnabled({ toolId: 'page-size-switcher', enabled: false });

    expect(saved).toMatchObject({ ok: false, error: { kind: 'storageFailed' } });
    expect(mockState().local.settings).toBeUndefined();
  });

  it('rapid toggles are saved in order and the last value wins (BR1.5)', async () => {
    const first = setEnabled({ toolId: 'page-size-switcher', enabled: false });
    const second = setEnabled({ toolId: 'page-size-switcher', enabled: true });
    const third = setEnabled({ toolId: 'page-size-switcher', enabled: false });

    await Promise.all([first, second, third]);

    const written = mockState().localSetCalls.map(
      (items) =>
        (items as { settings: { tools: Record<string, { enabled: boolean }> } }).settings.tools[
          'page-size-switcher'
        ]?.enabled,
    );
    expect(written).toEqual([false, true, false]);
    expect(await isEnabled({ toolId: 'page-size-switcher' })).toBe(false);
  });

  it('saves write the whole data in the current shape, replacing unreadable old data (BR1.5)', async () => {
    mockState().local.settings = { schemaVersion: 99, tools: 'broken' };

    await setEnabled({ toolId: 'page-size-switcher', enabled: false });

    // Written with every tool's value (U3 added changeset-viewer and changeset-add-assist to the list)
    expect(mockState().local.settings).toEqual(
      validSettings({
        'page-size-switcher': { enabled: false },
        'changeset-viewer': { enabled: true },
        'changeset-add-assist': { enabled: true },
      }),
    );
  });

  it('isEnabled is true even when loading fails (FR1.6)', async () => {
    mockState().local.settings = validSettings({ 'page-size-switcher': { enabled: false } });
    setStorageFailure({ get: 'throw' });

    expect(await isEnabled({ toolId: 'page-size-switcher' })).toBe(true);
  });
});
