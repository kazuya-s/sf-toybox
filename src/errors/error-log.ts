/**
 * Error logging (security-design.md §5, monitoring-design.md "Logs & Tracing").
 * - Writes to the console prefixed with `[sf-toybox:<toolId>]` (exception text goes to the console only)
 * - Keeps the newest 20 entries in errorLog in chrome.storage.local
 * - Stores only the tool ID, kind, time and message key. Never stores exception text or URLs
 * - Never throws even if logging fails
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
  /** ISO 8601 time */
  at: string;
  /** Only the _locales message ID (the design key) */
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

/** Queue that serializes writes within the same page */
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * The single place for errorLog's read-then-write.
 * Losing an entry when another frame or the options page writes at the same time is accepted (infrastructure-specification.md).
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
 * Logs an error to the console and appends it to errorLog. Never rejects.
 * @param cause Original exception, written to the console only (never stored)
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
    // A logging failure only goes to the console (never try to log the logging failure)
    if (!saved.ok) console.error(prefix, 'Failed to save errorLog', saved.error.kind);
  } catch (error) {
    console.error(prefix, 'Failed to save errorLog', error);
  }
}

/** Recent errors (newest first). Empty list when they cannot be read */
export async function getRecentErrors(): Promise<ErrorLogEntry[]> {
  const current = await readLocal(ERROR_LOG_STORAGE_KEY);
  return current.ok ? toEntries(current.value) : [];
}

/** Clears recent errors */
export async function clearErrors(): Promise<Result<void>> {
  const result = await updateErrorLog(() => []);
  return result.ok ? ok(undefined) : result;
}
