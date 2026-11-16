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

describe('Stored settings shape (stored-settings)', () => {
  it('uses a valid shape as is and returns the stored values', () => {
    const parsed = parseStoredSettings(validSettings());

    expect(parsed.loadFailed).toBe(false);
    expect(resolveEnabled(parsed.settings, 'page-size-switcher')).toBe(false);
  });

  it('with nothing stored, it is not loadFailed and everything is ON (BR1.2)', () => {
    const parsed = parseStoredSettings(undefined);

    expect(parsed.loadFailed).toBe(false);
    expect(resolveEnabled(parsed.settings, 'page-size-switcher')).toBe(true);
    expect(resolveEnabled(parsed.settings, 'changeset-viewer')).toBe(true);
  });

  it('tools missing from the stored data are ON and unknown entries are ignored (AC1.1.3)', () => {
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

  it('migrates the old unversioned shape to the current one (BR1.4)', () => {
    const parsed = parseStoredSettings(legacySettings);

    expect(parsed.loadFailed).toBe(false);
    expect(parsed.settings).toEqual({
      schemaVersion: 1,
      tools: { 'page-size-switcher': { enabled: false }, 'changeset-viewer': { enabled: true } },
    });
  });

  it('a newer version is loadFailed and treated as all ON (BR1.3, BR1.4)', () => {
    const parsed = parseStoredSettings(futureSettings);

    expect(parsed.loadFailed).toBe(true);
    expect(resolveEnabled(parsed.settings, 'page-size-switcher')).toBe(true);
  });

  it.each(brokenSettingsValues)('a broken shape (%j) is loadFailed (BR1.3)', (raw) => {
    const parsed = parseStoredSettings(raw);

    expect(parsed.loadFailed).toBe(true);
    expect(parsed.settings.tools).toEqual({});
  });

  it('toStoredSettings builds the current shape from all tools values (BR1.5)', () => {
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
