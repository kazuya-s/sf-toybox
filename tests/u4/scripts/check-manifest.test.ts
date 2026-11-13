/**
 * manifest の確認スクリプトに U4 で足した確認（U4 cicd-pipeline.md 段階 5・6、NFR3.2、NFR7.2）。
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkBuild } from '../../../scripts/check-manifest.mjs';
import { validBuild, writeBuild, type FakeBuild } from '../../u1/fixtures/build-output';

/** 一時的なフォルダはプロジェクトの中（node_modules/.cache）に作り、テストのあとで消す */
const TEMP_PARENT = resolve(process.cwd(), 'node_modules/.cache/sftoybox-check-manifest-u4');

/** 追加支援の部品が React の部品と CSS を読み込む、偽のビルド結果 */
function validU4Build(): FakeBuild {
  const build = validBuild();
  build.viteManifests['changeset-add-assist'] = {
    'virtual:entry?/entrypoints/changeset-add-assist.ts': {
      file: 'changeset-add-assist.js',
      name: 'changeset-add-assist',
      isEntry: true,
      imports: ['_react-u4.js'],
      css: ['assets/add-assist.css'],
    },
    '_react-u4.js': { file: 'chunks/react-u4.js', name: 'react' },
  };
  const war = build.manifest.web_accessible_resources[0];
  war?.resources.push('assets/add-assist.css');
  build.moduleLists.salesforce?.[0]?.modules.push('src/changeset-add-assist/load.ts');
  build.files['chunks/react-u4.js'] = 'export const r = 1;\n';
  build.files['assets/add-assist.css'] = ':host{display:block}\n';
  return build;
}

describe('manifest の確認スクリプトに U4 で足した確認', () => {
  let root: string;

  beforeEach(() => {
    mkdirSync(TEMP_PARENT, { recursive: true });
    root = mkdtempSync(join(TEMP_PARENT, 'case-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** 1 回ごとに別のフォルダへ書き出し、前の書き出しの残りを読まないようにする */
  function run(build: FakeBuild): string[] {
    return checkBuild(writeBuild(mkdtempSync(join(root, 'run-')), build)).errors;
  }

  it('追加支援の部品とその読み込み先が web_accessible_resources に揃っていれば通る', () => {
    expect(run(validU4Build())).toEqual([]);
  });

  it('追加支援の部品の読み込み先が 1 つ欠けたり、部品がビルドになかったりすると失敗する', () => {
    const build = validU4Build();
    const war = build.manifest.web_accessible_resources[0];
    if (war) war.resources = war.resources.filter((file) => file !== 'assets/add-assist.css');

    expect(run(build)).toEqual([
      '追加支援が読み込む assets/add-assist.css が web_accessible_resources に載っていません',
    ]);

    const missing = validU4Build();
    delete missing.viteManifests['changeset-add-assist'];
    expect(run(missing)).toEqual([
      'Vite の部品の一覧に追加支援の部品（changeset-add-assist）がありません',
    ]);
  });

  it('入口に追加支援の部品（React を含む）が静的に入ると、段階 6 の確認で失敗する', () => {
    const build = validU4Build();
    build.moduleLists.salesforce?.[0]?.modules.push(
      'src/changeset-add-assist/mount.tsx',
      'entrypoints/changeset-add-assist.ts',
      'node_modules/react/index.js',
    );

    const errors = run(build);

    expect(errors).toEqual([
      expect.stringContaining('入口に React が入っています'),
      expect.stringContaining('入口に追加支援の部品が入っています'),
    ]);
    expect(errors[1]).toContain('src/changeset-add-assist/mount.tsx');
    expect(errors[1]).not.toContain('load.ts');
  });
});
