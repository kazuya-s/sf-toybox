import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAll, isEnabled, setEnabled } from '../../../src/settings/tool-settings';
import { mockState, setStorageFailure } from '../helpers/chrome-mock';
import { validSettings } from '../fixtures/settings';

describe('ツールの ON/OFF（tool-settings、C1）', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('初回（保存値なし）は全部 ON（AC1.1.2）', async () => {
    const all = await getAll();

    expect(all.loadFailed).toBe(false);
    expect(all.settings.length).toBeGreaterThan(0);
    expect(all.settings.every((item) => item.enabled)).toBe(true);
  });

  it('OFF にして保存すると、読み直しても OFF（AC1.1.1）', async () => {
    const saved = await setEnabled({ toolId: 'page-size-switcher', enabled: false });

    expect(saved.ok).toBe(true);
    expect(await isEnabled({ toolId: 'page-size-switcher' })).toBe(false);
    expect((await getAll()).settings).toContainEqual({
      toolId: 'page-size-switcher',
      enabled: false,
    });
  });

  it('読み込みに失敗すると全部 ON で loadFailed、エラーを記録する（AC1.1.5、BR1.3）', async () => {
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

  it('保存に失敗すると storageFailed を返す（BR1.5）', async () => {
    setStorageFailure({ set: 'lastError' });

    const saved = await setEnabled({ toolId: 'page-size-switcher', enabled: false });

    expect(saved).toMatchObject({ ok: false, error: { kind: 'storageFailed' } });
    expect(mockState().local.settings).toBeUndefined();
  });

  it('続けて切り替えると順に保存され、後の値が残る（BR1.5）', async () => {
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

  it('保存は今の形で全体を書き、読めなかった古いデータも置き換える（BR1.5）', async () => {
    mockState().local.settings = { schemaVersion: 99, tools: 'broken' };

    await setEnabled({ toolId: 'page-size-switcher', enabled: false });

    expect(mockState().local.settings).toEqual(
      validSettings({ 'page-size-switcher': { enabled: false } }),
    );
  });

  it('isEnabled は読み込みに失敗しても true（FR1.6）', async () => {
    mockState().local.settings = validSettings({ 'page-size-switcher': { enabled: false } });
    setStorageFailure({ get: 'throw' });

    expect(await isEnabled({ toolId: 'page-size-switcher' })).toBe(true);
  });
});
