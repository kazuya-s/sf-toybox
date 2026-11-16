import { describe, expect, it } from 'vitest';
import { lintRuleIds } from './helpers';

/** A U3 file path (cicd-pipeline.md stage 2, "Verifying the rules work") */
const U3_FILE = 'src/changeset-viewer/x.ts';
const U3_TSX_FILE = 'src/changeset-viewer/ui/x.tsx';

describe('U3 ESLint bans (cicd-pipeline.md stage 2)', () => {
  it('fetch and window.fetch are errors (NFR1.1, NFR4.1)', async () => {
    expect(await lintRuleIds('fetch("/x");\n', U3_FILE)).toContain('no-restricted-globals');
    expect(await lintRuleIds('window.fetch("/x");\n', U3_FILE)).toContain(
      'no-restricted-properties',
    );
    expect(await lintRuleIds('new XMLHttpRequest();\n', U3_FILE)).toContain(
      'no-restricted-globals',
    );
  }, 30_000);

  it('chrome.storage.local, localStorage and document.cookie are errors (NFR1.1)', async () => {
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

  it('chrome.runtime.onMessageExternal is an error (NFR3.3)', async () => {
    expect(
      await lintRuleIds('chrome.runtime.onMessageExternal.addListener(() => {});\n', U3_FILE),
    ).toContain('no-restricted-syntax');
    expect(await lintRuleIds('chrome.runtime.onMessage.addListener(() => {});\n', U3_FILE)).toEqual(
      [],
    );
  }, 30_000);

  it('assigning innerHTML and dangerouslySetInnerHTML are errors (NFR3.1)', async () => {
    expect(await lintRuleIds('document.body.innerHTML = "<p>";\n', U3_FILE)).toContain(
      'no-restricted-properties',
    );
    const jsx = 'export const A = () => <div dangerouslySetInnerHTML={{ __html: "<p>" }} />;\n';
    expect(await lintRuleIds(jsx, U3_TSX_FILE)).toContain('react/no-danger');
  }, 30_000);

  it('eval is an error (NFR3.4)', async () => {
    expect(await lintRuleIds('eval("1");\n', U3_FILE)).toContain('no-eval');
    expect(await lintRuleIds('new Function("return 1");\n', U3_FILE)).toContain('no-new-func');
  }, 30_000);

  it('U1/U2 file bans are unchanged (fetch is an error in src/salesforce/parse.ts)', async () => {
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
