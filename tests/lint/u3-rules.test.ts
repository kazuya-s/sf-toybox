import { describe, expect, it } from 'vitest';
import { lintRuleIds } from './helpers';

/** U3 のファイルの場所（cicd-pipeline.md 段階 2「効いていることの確かめ」） */
const U3_FILE = 'src/changeset-viewer/x.ts';
const U3_TSX_FILE = 'src/changeset-viewer/ui/x.tsx';

describe('U3 の ESLint の禁止（cicd-pipeline.md 段階 2）', () => {
  it('fetch と window.fetch がエラーになる（NFR1.1、NFR4.1）', async () => {
    expect(await lintRuleIds('fetch("/x");\n', U3_FILE)).toContain('no-restricted-globals');
    expect(await lintRuleIds('window.fetch("/x");\n', U3_FILE)).toContain(
      'no-restricted-properties',
    );
    expect(await lintRuleIds('new XMLHttpRequest();\n', U3_FILE)).toContain(
      'no-restricted-globals',
    );
  }, 30_000);

  it('chrome.storage.local、localStorage、document.cookie がエラーになる（NFR1.1）', async () => {
    expect(await lintRuleIds('chrome.storage.local.get("k");\n', U3_FILE)).toContain(
      'no-restricted-properties',
    );
    expect(await lintRuleIds('localStorage.getItem("k");\n', U3_FILE)).toContain(
      'no-restricted-globals',
    );
    expect(await lintRuleIds('export const c = document.cookie;\n', U3_FILE)).toContain(
      'no-restricted-properties',
    );
  }, 30_000);

  it('chrome.runtime.onMessageExternal がエラーになる（NFR3.3）', async () => {
    expect(
      await lintRuleIds('chrome.runtime.onMessageExternal.addListener(() => {});\n', U3_FILE),
    ).toContain('no-restricted-syntax');
    expect(await lintRuleIds('chrome.runtime.onMessage.addListener(() => {});\n', U3_FILE)).toEqual(
      [],
    );
  }, 30_000);

  it('innerHTML への代入と dangerouslySetInnerHTML がエラーになる（NFR3.1）', async () => {
    expect(await lintRuleIds('document.body.innerHTML = "<p>";\n', U3_FILE)).toContain(
      'no-restricted-properties',
    );
    const jsx = 'export const A = () => <div dangerouslySetInnerHTML={{ __html: "<p>" }} />;\n';
    expect(await lintRuleIds(jsx, U3_TSX_FILE)).toContain('react/no-danger');
  }, 30_000);

  it('eval がエラーになる（NFR3.4）', async () => {
    expect(await lintRuleIds('eval("1");\n', U3_FILE)).toContain('no-eval');
    expect(await lintRuleIds('new Function("return 1");\n', U3_FILE)).toContain('no-new-func');
  }, 30_000);

  it('U1・U2 のファイルの禁止は変わらない（src/salesforce/parse.ts で fetch がエラー）', async () => {
    expect(await lintRuleIds('fetch("/x");\n', 'src/salesforce/parse.ts')).toContain(
      'no-restricted-globals',
    );
    expect(await lintRuleIds('fetch("/x");\n', 'src/salesforce/connection.ts')).toEqual([]);
    expect(
      await lintRuleIds('chrome.storage.local.get("k");\n', 'src/storage/lint-sample.ts'),
    ).toEqual([]);
    expect(await lintRuleIds('location.hostname;\n', 'src/changeset/x.ts')).toContain(
      'no-restricted-syntax',
    );
  }, 30_000);
});
