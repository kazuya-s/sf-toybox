/**
 * ツールの ON/OFF（contract-summary.md C1 の ToolSettingsApi）。
 * 保存先は chrome.storage.local だけ（BR1.1）。読み込めないときはすべて ON（BR1.3）。
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

/** 全ツールの ON/OFF。読み込めないときはすべて ON で loadFailed: true（BR1.2、BR1.3） */
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

/** そのツールが ON か。読み込めないときや一覧にないツールも true（FR1.6） */
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

/** 保存を 1 件ずつ順に行うための列（BR1.5: 後の操作が勝つ） */
let saveQueue: Promise<unknown> = Promise.resolve();

async function saveOne(toolId: ToolId, enabled: boolean): Promise<Result<void>> {
  const current = await getAll();
  const values = current.settings.map((item) =>
    item.toolId === toolId ? { toolId, enabled } : item,
  );
  if (!values.some((item) => item.toolId === toolId)) values.push({ toolId, enabled });
  // 保存のたびに、全ツールの値で保存データ全体を今の形で書く（読めなかった古いデータも置き換わる）
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

/** ツールの ON/OFF を保存する。オプションページだけが使う */
export function setEnabled({ toolId, enabled }: ToolEnabledValue): Promise<Result<void>> {
  const task = saveQueue.then(() => saveOne(toolId, enabled));
  saveQueue = task.catch(() => undefined);
  return task;
}
