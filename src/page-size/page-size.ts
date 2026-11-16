/**
 * Page-size switching: input validation and URL rebuilding (BR3.1-BR3.5, security-design.md §4).
 */
import { PAGE_MARKERS } from '../page/page-context';

/** Values of the page-size buttons (BR3.1) */
export const PRESET_SIZES = [100, 500, 1000, 2000] as const;

export type PresetSize = (typeof PRESET_SIZES)[number];

/** Digits only, starting with 1-9 (BR3.2). No upper limit (BR3.5) */
const PAGE_SIZE_PATTERN = /^[1-9][0-9]*$/;

/**
 * Validates the entered page size. Trims whitespace and returns only strings of integers 1 or greater.
 * Returned as a digit string, not a number, so large values are never rounded. null when rejected.
 */
export function parsePageSizeInput(text: string): string | null {
  const trimmed = text.trim();
  return PAGE_SIZE_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Replaces only rowsperpage (adds it if missing). Other parameters and their order are kept (BR3.3).
 * Built with URL and URLSearchParams, never by concatenating strings.
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

/** Button value matching the current rowsperpage; null if none matches (BR3.4) */
export function selectedPreset(href: string): PresetSize | null {
  const current = new URL(href).searchParams.get(PAGE_MARKERS.rowsPerPageParam);
  return PRESET_SIZES.find((size) => String(size) === current) ?? null;
}
