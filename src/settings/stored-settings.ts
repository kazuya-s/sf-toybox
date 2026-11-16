/**
 * Validation and migration of the stored settings (StoredSettings) shape (contract-summary.md C1, BR1.2-BR1.5).
 * Only pure functions here; no storage reads or writes.
 */
import { isToolId, type ToolId } from '../shared/tool-ids';

export const CURRENT_SCHEMA_VERSION = 1;

/** Settings key in chrome.storage.local (infrastructure-specification.md) */
export const SETTINGS_STORAGE_KEY = 'settings';

export type StoredSettings = {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  tools: Partial<Record<ToolId, { enabled: boolean }>>;
};

export type ToolEnabledValue = { toolId: ToolId; enabled: boolean };

export type ParsedSettings = {
  settings: StoredSettings;
  /** true when the stored data had an unreadable shape (BR1.3) */
  loadFailed: boolean;
};

function emptySettings(): StoredSettings {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, tools: {} };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates version 1 tools. Unknown tool entries are ignored; returns null if the shape is invalid */
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
 * Migrates the old unversioned shape (`{ "<ToolId>": true | false }`) to version 1 (BR1.4).
 * Only version 1 exists today, so the unversioned shape stands in for "an older version".
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
 * Validates a value read from storage.
 * - No value: nothing stored (all ON; not loadFailed; BR1.2)
 * - schemaVersion 1: used as is
 * - No schemaVersion (old shape): migrated to the current shape (BR1.4)
 * - A newer version or an invalid shape: loadFailed (BR1.3)
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

/** Tools with no stored value are ON (BR1.2) */
export function resolveEnabled(settings: StoredSettings, toolId: ToolId): boolean {
  return settings.tools[toolId]?.enabled ?? true;
}

/** Builds the whole stored data in the current shape from the values of all displayed tools (BR1.5) */
export function toStoredSettings(values: readonly ToolEnabledValue[]): StoredSettings {
  const tools: StoredSettings['tools'] = {};
  for (const { toolId, enabled } of values) tools[toolId] = { enabled };
  return { schemaVersion: CURRENT_SCHEMA_VERSION, tools };
}
