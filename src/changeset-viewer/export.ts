/**
 * コピーと CSV の出力（rules.md BR3.1〜BR3.7、security-design.md §2）。
 * 出力の文字はこのファイルだけで作る。値ごとの処理の順は
 * (1) 親オブジェクトがなければ空（BR3.3）→ (2) 数式にしない（BR3.5）→ (3) 引用符で囲む（BR3.4）。
 * copyRows・saveCsv は、画面のボタンの onClick の中からだけ呼ぶ（NFR1.2）。
 */
import { fail, ok, type Result } from '../shared/result';
import type { ChangeSetComponent } from './types';

/** 出力の見出し（画面の言語の「種類」「API 名」「親オブジェクト」。BR3.2） */
export type ExportHeaders = readonly [type: string, apiName: string, parentObject: string];

const LINE_END = '\r\n';
const BOM = '﻿';
/** 数式として動きうる先頭の文字（BR3.5） */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
/** 引用符で囲む文字（BR3.4） */
const NEEDS_QUOTE = /[",\r\n\t]/;

/** 1 つの値を出力の形にする */
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

/** コピーの文字: タブ区切り、見出しの行つき、行の終わりは CRLF（BR3.6） */
export function toTsv(rows: readonly ChangeSetComponent[], headers: ExportHeaders): string {
  return toLines(rows, headers, '\t');
}

/** CSV の文字: カンマ区切り、先頭に BOM、行の終わりは CRLF（BR3.6） */
export function toCsv(rows: readonly ChangeSetComponent[], headers: ExportHeaders): string {
  return `${BOM}${toLines(rows, headers, ',')}`;
}

/** ファイル名に使えない文字と制御文字（BR3.7） */
const INVALID_FILE_CHARS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const RESERVED_NAMES = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
const MAX_NAME_LENGTH = 100;

function yyyymmdd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}${month}${day}`;
}

/** CSV のファイル名「<名前>_<YYYYMMDD>.csv」（BR3.7 の 5 つの手順） */
export function csvFileName(name: string, date: Date): string {
  let base = name.replace(INVALID_FILE_CHARS, '_');
  base = Array.from(base).slice(0, MAX_NAME_LENGTH).join('');
  base = base.trim().replace(/\.+$/, '').trim();
  if (base === '') base = 'changeset';
  if (RESERVED_NAMES.test(base)) base = `_${base}`;
  return `${base}_${yyyymmdd(date)}.csv`;
}

/** クリップボードに書く。失敗は Result で返す（BR3.8） */
export async function copyRows(text: string): Promise<Result<void>> {
  try {
    await navigator.clipboard.writeText(text);
    return ok(undefined);
  } catch (error) {
    // AppError の種類に「書き込みの失敗」はないため、保存の失敗（storageFailed）として返す
    return fail('storageFailed', 'clipboard write failed', errorName(error));
  }
}

/** Blob と a 要素で、利用者のブラウザの保存の操作としてファイルを保存する。失敗は Result で返す */
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

/** 例外の種類の名前だけを残す（文章には名前などが入りうるため） */
function errorName(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const name = (error as { name?: unknown }).name;
  return typeof name === 'string' ? name : null;
}
