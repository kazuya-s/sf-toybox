/**
 * Copy and CSV output (rules.md BR3.1-BR3.7, security-design.md §2).
 * Output text is produced only in this file. Each value is processed in this order:
 * (1) empty when there is no parent object (BR3.3) -> (2) neutralize formulas (BR3.5) -> (3) quote (BR3.4).
 * copyRows and saveCsv are called only from the buttons' onClick handlers (NFR1.2).
 */
import { fail, ok, type Result } from '../shared/result';
import type { ChangeSetComponent } from './types';

/** Output headers ("Type", "API Name", "Parent Object" in the UI language; BR3.2) */
export type ExportHeaders = readonly [type: string, apiName: string, parentObject: string];

const LINE_END = '\r\n';
const BOM = '﻿';
/** Leading characters that can trigger a formula (BR3.5) */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
/** Characters that require quoting (BR3.4) */
const NEEDS_QUOTE = /[",\r\n\t]/;

/** Formats one value for output */
export function formatCell(value: string | null): string {
  const text = value ?? '';
  const safe = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return NEEDS_QUOTE.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function toLines(
  rows: readonly ChangeSetComponent[],
  headers: ExportHeaders,
  separator: string,
): string {
  const lines = [
    headers.map(formatCell).join(separator),
    ...rows.map((row) =>
      [row.componentType, row.apiName, row.parentObject].map(formatCell).join(separator),
    ),
  ];
  return lines.map((line) => `${line}${LINE_END}`).join('');
}

/** Copy text: tab-separated, with a header row, CRLF line endings (BR3.6) */
export function toTsv(rows: readonly ChangeSetComponent[], headers: ExportHeaders): string {
  return toLines(rows, headers, '\t');
}

/** CSV text: comma-separated, BOM first, CRLF line endings (BR3.6) */
export function toCsv(rows: readonly ChangeSetComponent[], headers: ExportHeaders): string {
  return `${BOM}${toLines(rows, headers, ',')}`;
}

/** Characters not allowed in file names, and control characters (BR3.7) */
const INVALID_FILE_CHARS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const RESERVED_NAMES = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
const MAX_NAME_LENGTH = 100;

function yyyymmdd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}${month}${day}`;
}

/** CSV file name "<name>_<YYYYMMDD>.csv" (the five steps of BR3.7) */
export function csvFileName(name: string, date: Date): string {
  let base = name.replace(INVALID_FILE_CHARS, '_');
  base = Array.from(base).slice(0, MAX_NAME_LENGTH).join('');
  base = base.trim().replace(/\.+$/, '').trim();
  if (base === '') base = 'changeset';
  if (RESERVED_NAMES.test(base)) base = `_${base}`;
  return `${base}_${yyyymmdd(date)}.csv`;
}

/** Writes to the clipboard. Failures are returned as Result (BR3.8) */
export async function copyRows(text: string): Promise<Result<void>> {
  try {
    await navigator.clipboard.writeText(text);
    return ok(undefined);
  } catch (error) {
    // AppError has no "write failed" kind, so this is returned as a storage failure (storageFailed)
    return fail('storageFailed', 'clipboard write failed', errorName(error));
  }
}

/** Saves a file through the user's browser download using a Blob and an anchor element. Failures are returned as Result */
export function saveCsv(text: string, fileName: string): Result<void> {
  try {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return ok(undefined);
  } catch (error) {
    return fail('storageFailed', 'csv save failed', errorName(error));
  }
}

/** Keeps only the exception's type name (the message may contain names) */
function errorName(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const name = (error as { name?: unknown }).name;
  return typeof name === 'string' ? name : null;
}
