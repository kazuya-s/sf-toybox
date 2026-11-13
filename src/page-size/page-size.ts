/**
 * 件数の切り替えの判定と URL の作り直し（BR3.1〜BR3.5、security-design.md §4）。
 */
import { PAGE_MARKERS } from '../page/page-context';

/** 件数のボタンの値（BR3.1） */
export const PRESET_SIZES = [100, 500, 1000, 2000] as const;

export type PresetSize = (typeof PRESET_SIZES)[number];

/** 先頭が 1〜9 で数字だけ（BR3.2）。上限は設けない（BR3.5） */
const PAGE_SIZE_PATTERN = /^[1-9][0-9]*$/;

/**
 * 入力された件数を確かめる。前後の空白を除き、1 以上の整数の文字列だけを返す。
 * 大きな値でも丸めないよう、数値ではなく数字の文字列で返す。受け付けないときは null。
 */
export function parsePageSizeInput(text: string): string | null {
  const trimmed = text.trim();
  return PAGE_SIZE_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * rowsperpage だけを置き換える（なければ足す）。ほかのパラメータとその順序は保つ（BR3.3）。
 * 文字列をつなげず、URL と URLSearchParams で作る。
 */
export function buildPageSizeUrl(href: string, size: number | string): string {
  const value = String(size);
  if (!PAGE_SIZE_PATTERN.test(value)) {
    throw new RangeError(`page size must be a positive integer: ${value}`);
  }
  const url = new URL(href);
  url.searchParams.set(PAGE_MARKERS.rowsPerPageParam, value);
  return url.href;
}

/** 今の rowsperpage に当たるボタンの値。当たらなければ null（BR3.4） */
export function selectedPreset(href: string): PresetSize | null {
  const current = new URL(href).searchParams.get(PAGE_MARKERS.rowsPerPageParam);
  return PRESET_SIZES.find((size) => String(size) === current) ?? null;
}
