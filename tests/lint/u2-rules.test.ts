import { describe, expect, it } from 'vitest';
import { lintRuleIds } from './helpers';

/** A U2 file path (other than connection.ts) */
const U2_FILE = 'src/changeset/lint-sample.ts';
const CONNECTION_FILE = 'src/salesforce/connection.ts';

describe('U2 ESLint bans (cicd-pipeline.md stage 2)', () => {
  it('fetch, window.fetch and globalThis.fetch are errors outside connection.ts (NFR1.1)', async () => {
    expect(await lintRuleIds('fetch("/x");\n', U2_FILE)).toContain('no-restricted-globals');
    expect(await lintRuleIds('window.fetch("/x");\n', U2_FILE)).toContain(
      'no-restricted-properties',
    );
    expect(await lintRuleIds('globalThis.fetch("/x");\n', 'src/salesforce/parse.ts')).toContain(
      'no-restricted-properties',
    );
  }, 30_000);

  it('chrome.storage.local and localStorage are errors (NFR1.2)', async () => {
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

  it('document.cookie and chrome.cookies are errors (NFR2.2)', async () => {
    expect(await lintRuleIds('export const c = document.cookie;\n', U2_FILE)).toContain(
      'no-restricted-properties',
    );
    expect(await lintRuleIds('chrome.cookies.getAll({});\n', U2_FILE)).toContain(
      'no-restricted-properties',
    );
  }, 30_000);

  it('location.hostname and location.host (also the window.location form) are errors (NFR8.1)', async () => {
    for (const code of [
      'export const h = location.hostname;\n',
      'export const h = location.host;\n',
      'export const h = window.location.host;\n',
    ]) {
      expect(await lintRuleIds(code, U2_FILE)).toContain('no-restricted-syntax');
    }
    expect(await lintRuleIds('export const o = location.origin;\n', U2_FILE)).toEqual([]);
  }, 30_000);

  it('assigning innerHTML and eval are errors (NFR3.1, NFR3.4)', async () => {
    expect(await lintRuleIds('document.body.innerHTML = "<p>";\n', U2_FILE)).toContain(
      'no-restricted-properties',
    );
    expect(await lintRuleIds('eval("1");\n', U2_FILE)).toContain('no-eval');
    expect(await lintRuleIds('new Function("return 1");\n', U2_FILE)).toContain('no-new-func');
  }, 30_000);

  it('in connection.ts fetch is allowed while XMLHttpRequest and storage APIs are errors', async () => {
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

  it('U1 file rules are unchanged (fetch banned, storage APIs allowed in U1)', async () => {
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
