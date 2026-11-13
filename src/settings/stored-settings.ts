/**
 * 保存する設定（StoredSettings）の形の確かめと変換（contract-summary.md C1、BR1.2〜BR1.5）。
 * 保存の読み書きはしない純粋な関数だけを置く。
 */
import { isToolId, type ToolId } from '../shared/tool-ids';

export const CURRENT_SCHEMA_VERSION = 1;

/** chrome.storage.local の設定のキー（infrastructure-specification.md） */
export const SETTINGS_STORAGE_KEY = 'settings';

export type StoredSettings = {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  tools: Partial<Record<ToolId, { enabled: boolean }>>;
};

export type ToolEnabledValue = { toolId: ToolId; enabled: boolean };

export type ParsedSettings = {
  settings: StoredSettings;
  /** 保存データが読めない形だったとき true（BR1.3） */
  loadFailed: boolean;
};

function emptySettings(): StoredSettings {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, tools: {} };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 版 1 の tools を確かめる。知らないツールの項目は無視し、形が不正なら null */
function parseToolsV1(raw: unknown): StoredSettings['tools'] | null {
  if (!isPlainObject(raw)) return null;
  const tools: StoredSettings['tools'] = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (!isPlainObject(entry) || typeof entry.enabled !== 'boolean') return null;
    if (isToolId(key)) tools[key] = { enabled: entry.enabled };
  }
  return tools;
}

/**
 * 版のない古い形（`{ "<ToolId>": true | false }`）を版 1 に変換する（BR1.4）。
 * 今は版 1 だけなので、版のない形を「今より小さい版」の例として扱う。
 */
function migrateLegacy(raw: Record<string, unknown>): StoredSettings['tools'] | null {
  const tools: StoredSettings['tools'] = {};
  for (const [key, enabled] of Object.entries(raw)) {
    if (typeof enabled !== 'boolean') return null;
    if (isToolId(key)) tools[key] = { enabled };
  }
  return tools;
}

/**
 * 保存領域から読んだ値を確かめる。
 * - 値がない: 保存値なし（すべて ON。loadFailed ではない。BR1.2）
 * - schemaVersion が 1: そのまま使う
 * - schemaVersion がない（古い形）: 今の形に変換する（BR1.4）
 * - それより新しい版、または形が不正: loadFailed（BR1.3）
 */
export function parseStoredSettings(raw: unknown): ParsedSettings {
  if (raw === undefined) return { settings: emptySettings(), loadFailed: false };
  if (!isPlainObject(raw)) return { settings: emptySettings(), loadFailed: true };

  if (!('schemaVersion' in raw)) {
    const migrated = migrateLegacy(raw);
    return migrated
      ? { settings: { schemaVersion: CURRENT_SCHEMA_VERSION, tools: migrated }, loadFailed: false }
      : { settings: emptySettings(), loadFailed: true };
  }

  if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return { settings: emptySettings(), loadFailed: true };
  }

  const tools = parseToolsV1(raw.tools);
  return tools
    ? { settings: { schemaVersion: CURRENT_SCHEMA_VERSION, tools }, loadFailed: false }
    : { settings: emptySettings(), loadFailed: true };
}

/** 保存値のないツールは ON（BR1.2） */
export function resolveEnabled(settings: StoredSettings, toolId: ToolId): boolean {
  return settings.tools[toolId]?.enabled ?? true;
}

/** 表示中の全ツールの値から、今の形の保存データ全体を作る（BR1.5） */
export function toStoredSettings(values: readonly ToolEnabledValue[]): StoredSettings {
  const tools: StoredSettings['tools'] = {};
  for (const { toolId, enabled } of values) tools[toolId] = { enabled };
  return { schemaVersion: CURRENT_SCHEMA_VERSION, tools };
}
