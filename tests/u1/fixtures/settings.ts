/**
 * 保存データの例（unit-test-instructions.md「テストのデータ」）。
 * 正しい形は StoredSettings の型で書き、形が変わったらテストが壊れるようにする。
 */
import type { StoredSettings } from '../../../src/settings/stored-settings';

export function validSettings(
  tools: StoredSettings['tools'] = { 'page-size-switcher': { enabled: false } },
): StoredSettings {
  return { schemaVersion: 1, tools };
}

/** 版のない古い形（BR1.4 の変換の例） */
export const legacySettings = { 'page-size-switcher': false, 'changeset-viewer': true };

/** 今より新しい版 */
export const futureSettings = {
  schemaVersion: 2,
  tools: { 'page-size-switcher': { enabled: true } },
};

/** 壊れた形 */
export const brokenSettingsValues: unknown[] = [
  null,
  [],
  'settings',
  { schemaVersion: 1, tools: { 'page-size-switcher': { enabled: 'no' } } },
];
