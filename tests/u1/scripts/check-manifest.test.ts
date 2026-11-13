import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkBuild } from '../../../scripts/check-manifest.mjs';
import { validBuild, writeBuild, type FakeBuild } from '../fixtures/build-output';

/** 一時的なフォルダはプロジェクトの中（node_modules/.cache）に作り、テストのあとで消す */
const TEMP_PARENT = resolve(process.cwd(), 'node_modules/.cache/sftoybox-check-manifest');

describe('manifest の確認スクリプト（check-manifest、cicd-pipeline.md 段階 5・6）', () => {
  let root: string;

  beforeEach(() => {
    mkdirSync(TEMP_PARENT, { recursive: true });
    root = mkdtempSync(join(TEMP_PARENT, 'case-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function run(build: FakeBuild): string[] {
    return checkBuild(writeBuild(root, build)).errors;
  }

  it('正しい形のときは通る（ライセンスの注記と名前空間の文字列は外部 URL に数えない）', () => {
    expect(run(validBuild())).toEqual([]);
  });

  it('余分な権限、host_permissions、CSP、文書にない権限で失敗する', () => {
    const build = validBuild();
    build.manifest.permissions = ['storage', 'tabs'];
    build.manifest.host_permissions = ['https://*.salesforce.com/*'];
    build.manifest.content_security_policy = { extension_pages: "script-src 'self'" };

    const errors = run(build);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('許可していない権限があります: tabs'),
        expect.stringContaining('host_permissions'),
        expect.stringContaining('content_security_policy'),
        expect.stringContaining('`tabs` の項目がありません'),
      ]),
    );
  });

  it('matches に Salesforce の外のドメインがあると失敗する', () => {
    const build = validBuild();
    build.manifest.content_scripts[0]?.matches.push('https://*.example.com/*');
    build.manifest.web_accessible_resources[0]?.matches.push('<all_urls>');

    const errors = run(build);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('content_scripts[0] の matches に Salesforce 以外があります'),
        expect.stringContaining(
          'web_accessible_resources[0] の matches に Salesforce 以外があります',
        ),
      ]),
    );
  });

  it('件数バーが読み込むファイルが web_accessible_resources に漏れていると失敗する', () => {
    const build = validBuild();
    const war = build.manifest.web_accessible_resources[0];
    if (war) war.resources = ['page-size-bar.js'];

    const errors = run(build);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'chunks/react-abc123.js が web_accessible_resources に載っていません',
        ),
        expect.stringContaining('assets/bar.css が web_accessible_resources に載っていません'),
      ]),
    );
  });

  it.each([
    ['content-scripts/salesforce.js', 'import("https://cdn.example.com/x.js");'],
    ['assets/bar.css', '@import url("https://fonts.example.com/font.css");'],
    ['assets/bar.css', '.x{background:url(https://cdn.example.com/a.png)}'],
    ['options.html', '<link rel="stylesheet" href="https://cdn.example.com/slds.css">'],
  ])('外部の URL から読み込む書き方があると失敗する: %s', (file, content) => {
    const build = validBuild();
    build.files[file] = `${build.files[file] ?? ''}\n${content}`;

    const errors = run(build);

    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) expect(error).toContain(`${file} に外部の URL から読み込む書き方`);
  });

  it('入口に React が入っていると失敗する', () => {
    const build = validBuild();
    build.moduleLists.salesforce?.[0]?.modules.push(
      'node_modules/react/cjs/react.production.js',
      'node_modules/react-dom/client.js',
    );

    expect(run(build)).toEqual([expect.stringContaining('入口に React が入っています')]);
  });
});
