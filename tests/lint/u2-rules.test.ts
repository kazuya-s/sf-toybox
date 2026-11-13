import { describe, expect, it } from 'vitest';
import { lintRuleIds } from './helpers';

/** U2 のファイルの場所（connection.ts 以外） */
const U2_FILE = 'src/changeset/lint-sample.ts';
const CONNECTION_FILE = 'src/salesforce/connection.ts';

describe('U2 の ESLint の禁止（cicd-pipeline.md 段階 2）', () => {
  it('connection.ts 以外では fetch と window.fetch・globalThis.fetch がエラーになる（NFR1.1）', async () => {
    expect(await lintRuleIds('fetch("/x");\n', U2_FILE)).toContain('no-restricted-globals');
    expect(await lintRuleIds('window.fetch("/x");\n', U2_FILE)).toContain(
      'no-restricted-properties',
    );
    expect(await lintRuleIds('globalThis.fetch("/x");\n', 'src/salesforce/parse.ts')).toContain(
      'no-restricted-properties',
    );
  }, 30_000);

  it('chrome.storage.local と localStorage がエラーになる（NFR1.2）', async () => {
    expect(await lintRuleIds('chrome.storage.local.get("k");\n', U2_FILE)).toContain(
      'no-restricted-properties',
    );
    expect(await lintRuleIds('localStorage.getItem("k");\n', U2_FILE)).toContain(
      'no-restricted-globals',
    );
    expect(await lintRuleIds('window.sessionStorage.clear();\n', U2_FILE)).toContain(
      'no-restricted-properties',
    );
  }, 30_000);

  it('document.cookie と chrome.cookies がエラーになる（NFR2.2）', async () => {
    expect(await lintRuleIds('export const c = document.cookie;\n', U2_FILE)).toContain(
      'no-restricted-properties',
    );
    expect(await lintRuleIds('chrome.cookies.getAll({});\n', U2_FILE)).toContain(
      'no-restricted-properties',
    );
  }, 30_000);

  it('location.hostname と location.host（window.location の形も）がエラーになる（NFR8.1）', async () => {
    for (const code of [
      'export const h = location.hostname;\n',
      'export const h = location.host;\n',
      'export const h = window.location.host;\n',
    ]) {
      expect(await lintRuleIds(code, U2_FILE)).toContain('no-restricted-syntax');
    }
    expect(await lintRuleIds('export const o = location.origin;\n', U2_FILE)).toEqual([]);
  }, 30_000);

  it('innerHTML への代入と eval がエラーになる（NFR3.1、NFR3.4）', async () => {
    expect(await lintRuleIds('document.body.innerHTML = "<p>";\n', U2_FILE)).toContain(
      'no-restricted-properties',
    );
    expect(await lintRuleIds('eval("1");\n', U2_FILE)).toContain('no-eval');
    expect(await lintRuleIds('new Function("return 1");\n', U2_FILE)).toContain('no-new-func');
  }, 30_000);

  it('connection.ts では fetch がエラーにならず、XMLHttpRequest と保存の手段はエラーになる', async () => {
    expect(await lintRuleIds('fetch("/x");\n', CONNECTION_FILE)).toEqual([]);
    expect(await lintRuleIds('new XMLHttpRequest();\n', CONNECTION_FILE)).toContain(
      'no-restricted-globals',
    );
    expect(await lintRuleIds('indexedDB.open("x");\n', CONNECTION_FILE)).toContain(
      'no-restricted-globals',
    );
    expect(await lintRuleIds('window.fetch("/x");\n', CONNECTION_FILE)).toContain(
      'no-restricted-properties',
    );
  }, 30_000);

  it('U1 のファイルの決まりは変わらない（fetch は禁止、保存の手段は U1 では使える）', async () => {
    expect(await lintRuleIds('fetch("/x");\n', 'src/settings/lint-sample.ts')).toContain(
      'no-restricted-globals',
    );
    expect(
      await lintRuleIds('chrome.storage.local.get("k");\n', 'src/storage/lint-sample.ts'),
    ).toEqual([]);
    expect(await lintRuleIds('document.body.innerHTML = "<p>";\n', 'src/page/x.ts')).toContain(
      'no-restricted-properties',
    );
  }, 30_000);
});
