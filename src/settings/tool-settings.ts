/**
 * Tool ON/OFF (ToolSettingsApi of C1 in contract-summary.md).
 * Stored only in chrome.storage.local (BR1.1). Everything is ON when it cannot be read (BR1.3).
 */
import { recordError } from '../errors/error-log';
import { ok, type Result } from '../shared/result';
import { TOOL_DEFINITIONS, type ToolId } from '../shared/tool-ids';
import { readLocal, writeLocal } from '../storage/local-storage';
import {
  SETTINGS_STORAGE_KEY,
  parseStoredSettings,
  resolveEnabled,
  toStoredSettings,
  type ToolEnabledValue,
} from './stored-settings';

export type AllToolSettings = {
  settings: ToolEnabledValue[];
  loadFailed: boolean;
};

function allEnabled(): ToolEnabledValue[] {
  return TOOL_DEFINITIONS.map(({ toolId }) => ({ toolId, enabled: true }));
}

/** ON/OFF for all tools. When unreadable, all ON with loadFailed: true (BR1.2, BR1.3) */
export async function getAll(): Promise<AllToolSettings> {
  const read = await readLocal(SETTINGS_STORAGE_KEY);
  if (!read.ok) {
    await recordError({
      toolId: 'core',
      kind: read.error.kind,
      messageKey: 'errorLog.settingsLoadFailed',
    });
    return { settings: allEnabled(), loadFailed: true };
  }

  const parsed = parseStoredSettings(read.value);
  if (parsed.loadFailed) {
    await recordError({
      toolId: 'core',
      kind: 'unexpected',
      messageKey: 'errorLog.settingsInvalid',
    });
  }
  return {
    settings: TOOL_DEFINITIONS.map(({ toolId }) => ({
      toolId,
      enabled: resolveEnabled(parsed.settings, toolId),
    })),
    loadFailed: parsed.loadFailed,
  };
}

/** Whether the tool is ON. Also true when unreadable or for tools not in the list (FR1.6) */
export async function isEnabled({ toolId }: { toolId: ToolId }): Promise<boolean> {
  try {
    const { settings } = await getAll();
    return settings.find((item) => item.toolId === toolId)?.enabled ?? true;
  } catch (error) {
    await recordError(
      { toolId: 'core', kind: 'unexpected', messageKey: 'errorLog.settingsLoadFailed' },
      error,
    );
    return true;
  }
}

/** Queue that serializes saves (BR1.5: the later operation wins) */
let saveQueue: Promise<unknown> = Promise.resolve();

async function saveOne(toolId: ToolId, enabled: boolean): Promise<Result<void>> {
  const current = await getAll();
  const values = current.settings.map((item) =>
    item.toolId === toolId ? { toolId, enabled } : item,
  );
  if (!values.some((item) => item.toolId === toolId)) values.push({ toolId, enabled });
  // Every save writes the whole data in the current shape from all tools' values (unreadable old data is replaced)
  const written = await writeLocal(SETTINGS_STORAGE_KEY, toStoredSettings(values));
  if (!written.ok) {
    await recordError({
      toolId: 'core',
      kind: written.error.kind,
      messageKey: 'errorLog.settingsSaveFailed',
    });
    return written;
  }
  return ok(undefined);
}

/** Saves a tool's ON/OFF. Used only by the options page */
export function setEnabled({ toolId, enabled }: ToolEnabledValue): Promise<Result<void>> {
  const task = saveQueue.then(() => saveOne(toolId, enabled));
  saveQueue = task.catch(() => undefined);
  return task;
}
