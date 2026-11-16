/**
 * Example stored data (unit-test-instructions.md "Test data").
 * The valid shape is typed as StoredSettings so tests break when the shape changes.
 */
import type { StoredSettings } from '../../../src/settings/stored-settings';

export function validSettings(
  tools: StoredSettings['tools'] = { 'page-size-switcher': { enabled: false } },
): StoredSettings {
  return { schemaVersion: 1, tools };
}

/** Old unversioned shape (example for the BR1.4 migration) */
export const legacySettings = { 'page-size-switcher': false, 'changeset-viewer': true };

/** A version newer than the current one */
export const futureSettings = {
  schemaVersion: 2,
  tools: { 'page-size-switcher': { enabled: true } },
};

/** Broken shape */
export const brokenSettingsValues: unknown[] = [
  null,
  [],
  'settings',
  { schemaVersion: 1, tools: { 'page-size-switcher': { enabled: 'no' } } },
];
