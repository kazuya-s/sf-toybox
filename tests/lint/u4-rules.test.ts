import { describe, expect, it } from 'vitest';
import { lintRuleIds } from './helpers';

/** U4 のファイルの場所（U4 cicd-pipeline.md 段階 2） */
const U4_FILES = ['src/changeset-add-assist/x.ts', 'entrypoints/changeset-add-assist.ts'];
const U4_STATE_FILE = 'src/changeset-add-assist/state.ts';

describe('U4 の ESLint の禁止（cicd-pipeline.md 段階 2）', () => {
  it('fetch と window.fetch がエラーになる（NFR1.1、NFR4.1）', async () => {
    for (const file of U4_FILES) {
      expect(await lintRuleIds('fetch("/x");\n', file)).toContain('no-restricted-globals');
      expect(await lintRuleIds('window.fetch("/x");\n', file)).toContain(
        'no-restricted-properties',
      );
      expect(await lintRuleIds('globalThis.XMLHttpRequest;\n', file)).toContain(
        'no-restricted-properties',
      );
    }
  }, 30_000);

  it('chrome.storage.local・localStorage・document.cookie がエラーになる（NFR1.1）', async () => {
    for (const file of U4_FILES) {
      expect(await lintRuleIds('chrome.storage.local.get("k");\n', file)).toContain(
        'no-restricted-properties',
      );
      expect(await lintRuleIds('localStorage.getItem("k");\n', file)).toContain(
        'no-restricted-globals',
      );
      expect(await lintRuleIds('export const c = document.cookie;\n', file)).toContain(
        'no-restricted-properties',
      );
    }
  }, 30_000);

  it('innerHTML への代入と dangerouslySetInnerHTML がエラーになる（NFR3.1）', async () => {
    expect(
      await lintRuleIds('document.body.innerHTML = "<p>";\n', 'src/changeset-add-assist/x.ts'),
    ).toContain('no-restricted-properties');
    expect(
      await lintRuleIds(
        'export const A = () => <div dangerouslySetInnerHTML={{ __html: "<p>" }} />;\n',
        'src/changeset-add-assist/ui/X.tsx',
      ),
    ).toContain('react/no-danger');
  }, 30_000);

  it('eval がエラーになる（NFR3.2）', async () => {
    for (const file of U4_FILES) {
      expect(await lintRuleIds('eval("1");\n', file)).toContain('no-eval');
    }
  }, 30_000);

  it('state.ts の外で addComponent を読み込むとエラーになる（NFR3.3）', async () => {
    const cases = [
      ["import { addComponent } from '../salesforce';\n", 'src/changeset-add-assist/x.ts'],
      [
        "import { addComponent } from '../../salesforce/index';\n",
        'src/changeset-add-assist/ui/X.tsx',
      ],
      ["export { addComponent } from '../salesforce/index';\n", 'src/changeset-add-assist/x.ts'],
      [
        "import { addComponent } from '../changeset/add-component';\n",
        'src/changeset-add-assist/x.ts',
      ],
      ["import { addComponent } from '../src/salesforce/index';\n", U4_FILES[1] ?? ''],
    ] as const;
    for (const [code, file] of cases) {
      expect(await lintRuleIds(`${code}export const a = 1;\n`, file), file).toContain(
        'no-restricted-imports',
      );
    }
    // 同じ入口から、ほかの関数や型を読むのはよい
    expect(
      await lintRuleIds(
        "import type { AddRequest } from '../salesforce/index';\nexport type A = AddRequest;\n",
        'src/changeset-add-assist/x.ts',
      ),
    ).toEqual([]);
  }, 30_000);

  it('state.ts では addComponent を読み込めるが、通信と保存の禁止は残る', async () => {
    expect(
      await lintRuleIds(
        "import { addComponent } from '../salesforce/index';\nexport const a = addComponent;\n",
        U4_STATE_FILE,
      ),
    ).toEqual([]);
    expect(await lintRuleIds('fetch("/x");\n', U4_STATE_FILE)).toContain('no-restricted-globals');
    expect(await lintRuleIds('sessionStorage.clear();\n', U4_STATE_FILE)).toContain(
      'no-restricted-globals',
    );
  }, 30_000);

  it('U1・U2 のファイルの禁止は変わらない', async () => {
    expect(await lintRuleIds('fetch("/x");\n', 'src/settings/lint-sample.ts')).toContain(
      'no-restricted-globals',
    );
    expect(
      await lintRuleIds('chrome.storage.local.get("k");\n', 'src/storage/lint-sample.ts'),
    ).toEqual([]);
    expect(await lintRuleIds('fetch("/x");\n', 'src/salesforce/connection.ts')).toEqual([]);
    expect(await lintRuleIds('localStorage.getItem("k");\n', 'src/changeset/x.ts')).toContain(
      'no-restricted-globals',
    );
    expect(
      await lintRuleIds(
        "import { addComponent } from '../salesforce/index';\nexport const a = addComponent;\n",
        'src/changeset/x.ts',
      ),
    ).toEqual([]);
  }, 30_000);
});
