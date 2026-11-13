/**
 * エラーの記録（security-design.md §5、monitoring-design.md「Logs & Tracing」）。
 * - コンソールに `[sf-toybox:<toolId>]` を付けて出す（例外の文章はコンソールにだけ出す）
 * - chrome.storage.local の errorLog に、新しいものから 20 件まで残す
 * - 保存するのはツールの識別子・種類・時刻・文言キーだけ。例外の文章や URL は保存しない
 * - 記録に失敗しても例外を外に出さない
 */
import { APP_ERROR_KINDS, ok, type AppErrorKind, type Result } from '../shared/result';
import { isToolId, type LogToolId } from '../shared/tool-ids';
import { readLocal, writeLocal } from '../storage/local-storage';

export const ERROR_LOG_STORAGE_KEY = 'errorLog';
export const ERROR_LOG_MAX_ENTRIES = 20;

export type ErrorLogKind = AppErrorKind | 'unexpected';

export type ErrorLogEntry = {
  toolId: LogToolId;
  kind: ErrorLogKind;
  /** ISO 8601 の時刻 */
  at: string;
  /** _locales の文言の識別子（設計のキー）だけ */
  messageKey: string;
};

export type ErrorReport = Omit<ErrorLogEntry, 'at'>;

function isErrorLogEntry(value: unknown): value is ErrorLogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  const kinds: readonly string[] = [...APP_ERROR_KINDS, 'unexpected'];
  return (
    (entry.toolId === 'core' || isToolId(entry.toolId)) &&
    typeof entry.kind === 'string' &&
    kinds.includes(entry.kind) &&
    typeof entry.at === 'string' &&
    typeof entry.messageKey === 'string'
  );
}

function toEntries(raw: unknown): ErrorLogEntry[] {
  return Array.isArray(raw) ? raw.filter(isErrorLogEntry) : [];
}

/** 同じ画面の中での書き込みを 1 つずつ順に行うための列 */
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * errorLog の「読んでから書く」処理をここ 1 か所にまとめる。
 * 別のフレームや設定画面と同時に書いたときに記録が抜けることは許す（infrastructure-specification.md）。
 */
function updateErrorLog(
  change: (entries: ErrorLogEntry[]) => ErrorLogEntry[],
): Promise<Result<void>> {
  const task = writeQueue.then(async (): Promise<Result<void>> => {
    const current = await readLocal(ERROR_LOG_STORAGE_KEY);
    if (!current.ok) return current;
    const next = change(toEntries(current.value)).slice(0, ERROR_LOG_MAX_ENTRIES);
    return writeLocal(ERROR_LOG_STORAGE_KEY, next);
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

/**
 * エラーを記録する。コンソールに出し、errorLog に足す。決して reject しない。
 * @param cause コンソールにだけ出す元の例外（保存はしない）
 */
export async function recordError(report: ErrorReport, cause?: unknown): Promise<void> {
  const prefix = `[sf-toybox:${report.toolId}]`;
  if (cause === undefined) console.error(prefix, report.kind, report.messageKey);
  else console.error(prefix, report.kind, report.messageKey, cause);

  const entry: ErrorLogEntry = {
    toolId: report.toolId,
    kind: report.kind,
    at: new Date().toISOString(),
    messageKey: report.messageKey,
  };
  try {
    const saved = await updateErrorLog((entries) => [entry, ...entries]);
    // 記録の失敗はコンソールに出すだけにする（記録の失敗を記録しようとしてくり返さない）
    if (!saved.ok) console.error(prefix, 'errorLog の保存に失敗しました', saved.error.kind);
  } catch (error) {
    console.error(prefix, 'errorLog の保存に失敗しました', error);
  }
}

/** 最近のエラー（新しいものから）。読めないときは空の一覧 */
export async function getRecentErrors(): Promise<ErrorLogEntry[]> {
  const current = await readLocal(ERROR_LOG_STORAGE_KEY);
  return current.ok ? toEntries(current.value) : [];
}

/** 最近のエラーを消す */
export async function clearErrors(): Promise<Result<void>> {
  const result = await updateErrorLog(() => []);
  return result.ok ? ok(undefined) : result;
}
