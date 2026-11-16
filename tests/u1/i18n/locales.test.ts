import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGE_KEYS, toLocaleKey } from '../../../src/i18n/message-keys';
import { readLocaleMessages } from '../helpers/chrome-mock';

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Collects strings in the source that are written as message keys */
function keysUsedInSource(): string[] {
  const pattern =
    /(?:\bt\(\s*|messageKey:\s*|nameKey:\s*|descriptionKey:\s*)'([a-zA-Z]+(?:\.[a-zA-Z]+)+)'/g;
  const files = ['src', 'entrypoints'].flatMap((dir) =>
    listSourceFiles(resolve(process.cwd(), dir)),
  );
  const keys = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) keys.add(match[1] ?? '');
  }
  return [...keys];
}

describe('_locales messages (ja and en)', () => {
  const ja = readLocaleMessages('ja');
  const en = readLocaleMessages('en');

  it('ja and en have the same keys', () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });

  it('every key in the list and every key used in the source exists in both', () => {
    const used = keysUsedInSource();
    expect(used.length).toBeGreaterThan(5);

    for (const key of used) expect(MESSAGE_KEYS, key).toContain(key);
    for (const key of MESSAGE_KEYS) {
      expect(ja[toLocaleKey(key)], `ja: ${key}`).toBeDefined();
      expect(en[toLocaleKey(key)], `en: ${key}`).toBeDefined();
    }
  });

  it('no message is empty, and descriptions never promise speed gains (BR1.8)', () => {
    for (const [name, entry] of [...Object.entries(ja), ...Object.entries(en)]) {
      expect(entry.message.trim(), name).not.toBe('');
    }
    const descriptions = [ja.tool_pageSize_description?.message, ja.ext_description?.message];
    for (const text of descriptions) expect(text).not.toMatch(/軽くな|速くな/);
  });
});
