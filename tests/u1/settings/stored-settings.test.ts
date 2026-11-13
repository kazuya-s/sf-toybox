import { describe, expect, it } from 'vitest';
import {
  parseStoredSettings,
  resolveEnabled,
  toStoredSettings,
} from '../../../src/settings/stored-settings';
import {
  brokenSettingsValues,
  futureSettings,
  legacySettings,
  validSettings,
} from '../fixtures/settings';

describe('保存する設定の形（stored-settings）', () => {
  it('正しい形はそのまま使い、保存された値を返す', () => {
    const parsed = parseStoredSettings(validSettings());

    expect(parsed.loadFailed).toBe(false);
    expect(resolveEnabled(parsed.settings, 'page-size-switcher')).toBe(false);
  });

  it('保存値がないときは loadFailed にせず、すべて ON とする（BR1.2）', () => {
    const parsed = parseStoredSettings(undefined);

    expect(parsed.loadFailed).toBe(false);
    expect(resolveEnabled(parsed.settings, 'page-size-switcher')).toBe(true);
    expect(resolveEnabled(parsed.settings, 'changeset-viewer')).toBe(true);
  });

  it('保存データに載っていないツールは ON とし、知らない項目は無視する（AC1.1.3）', () => {
    const raw = {
      schemaVersion: 1,
      tools: { 'page-size-switcher': { enabled: false }, 'future-tool': { enabled: false } },
    };

    const parsed = parseStoredSettings(raw);

    expect(parsed.loadFailed).toBe(false);
    expect(resolveEnabled(parsed.settings, 'page-size-switcher')).toBe(false);
    expect(resolveEnabled(parsed.settings, 'changeset-add-assist')).toBe(true);
    expect(Object.keys(parsed.settings.tools)).toEqual(['page-size-switcher']);
  });

  it('版のない古い形は今の形に変換して使う（BR1.4）', () => {
    const parsed = parseStoredSettings(legacySettings);

    expect(parsed.loadFailed).toBe(false);
    expect(parsed.settings).toEqual({
      schemaVersion: 1,
      tools: { 'page-size-switcher': { enabled: false }, 'changeset-viewer': { enabled: true } },
    });
  });

  it('今より新しい版は loadFailed とし、すべて ON として扱う（BR1.3、BR1.4）', () => {
    const parsed = parseStoredSettings(futureSettings);

    expect(parsed.loadFailed).toBe(true);
    expect(resolveEnabled(parsed.settings, 'page-size-switcher')).toBe(true);
  });

  it.each(brokenSettingsValues)('壊れた形（%j）は loadFailed とする（BR1.3）', (raw) => {
    const parsed = parseStoredSettings(raw);

    expect(parsed.loadFailed).toBe(true);
    expect(parsed.settings.tools).toEqual({});
  });

  it('toStoredSettings は全ツールの値から今の形を作る（BR1.5）', () => {
    const stored = toStoredSettings([
      { toolId: 'page-size-switcher', enabled: true },
      { toolId: 'changeset-viewer', enabled: false },
    ]);

    expect(stored).toEqual({
      schemaVersion: 1,
      tools: { 'page-size-switcher': { enabled: true }, 'changeset-viewer': { enabled: false } },
    });
  });
});
