import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkBuild } from '../../../scripts/check-manifest.mjs';
import { validBuild, writeBuild, type FakeBuild } from '../../u1/fixtures/build-output';

/** 一時的なフォルダはプロジェクトの中（node_modules/.cache）に作り、テストのあとで消す */
const TEMP_PARENT = resolve(process.cwd(), 'node_modules/.cache/sftoybox-check-manifest-u2');

type PackageJson = Record<string, Record<string, string>>;

function validPackageJson(): PackageJson {
  return {
    dependencies: {
      '@salesforce-ux/design-system': '^2.264.3',
      react: '^19.3.1',
      'react-dom': '^19.3.1',
    },
    devDependencies: { vitest: '^5.1.0', wxt: '^0.21.5' },
  };
}

/** 実際のビルドに入る形のモジュールを足した、偽のビルド結果 */
function validU2Build(): FakeBuild {
  const build = validBuild();
  build.moduleLists.salesforce?.[0]?.modules.push(
    '\u0000virtual:wxt-plugins?entrypoint=salesforce',
    'node_modules/wxt/dist/utils/content-script-context.mjs',
    'node_modules/@wxt-dev/browser/src/index.mjs',
    'src/changeset/changeset.ts',
    'src/salesforce/connection.ts',
  );
  build.moduleLists.options = [
    {
      file: 'chunks/options.js',
      name: 'options',
      isEntry: true,
      imports: [],
      modules: [
        'node_modules/react/index.js',
        'node_modules/react-dom/client.js',
        'node_modules/scheduler/index.js',
        'node_modules/@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css',
        'assets/slds.css',
        'public/_locales/ja/messages.json',
        'package.json',
      ],
    },
  ];
  return build;
}

describe('manifest の確認スクリプトに U2 で足した確認（依存とモジュールの一覧、NFR3.4）', () => {
  let root: string;

  beforeEach(() => {
    mkdirSync(TEMP_PARENT, { recursive: true });
    root = mkdtempSync(join(TEMP_PARENT, 'case-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function run(build: FakeBuild, packageJson: PackageJson): string[] {
    const packageJsonPath = join(root, 'package.json');
    writeFileSync(packageJsonPath, JSON.stringify(packageJson));
    return checkBuild({ ...writeBuild(root, build), packageJson: packageJsonPath }).errors;
  }

  it('決めた依存と、決めた一覧の中のモジュールだけなら通る', () => {
    expect(run(validU2Build(), validPackageJson())).toEqual([]);
  });

  it('dependencies や optionalDependencies に 1 つ足すと失敗する', () => {
    const packageJson = validPackageJson();
    packageJson.dependencies = { ...packageJson.dependencies, lodash: '^4.0.0' };
    packageJson.optionalDependencies = { axios: '^1.0.0' };

    expect(run(validU2Build(), packageJson)).toEqual([
      'package.json の dependencies に決めた一覧にない依存があります: lodash',
      'package.json の optionalDependencies に決めた一覧にない依存があります: axios',
    ]);
  });

  it('peerDependencies に足しても失敗し、package.json がなければ失敗する', () => {
    const packageJson = validPackageJson();
    packageJson.peerDependencies = { jquery: '^3.0.0' };

    expect(run(validU2Build(), packageJson)).toEqual([
      'package.json の peerDependencies に決めた一覧にない依存があります: jquery',
    ]);
    const missing = checkBuild({
      ...writeBuild(root, validU2Build()),
      packageJson: join(root, 'missing.json'),
    }).errors;
    expect(missing).toEqual([expect.stringContaining('missing.json がありません')]);
  });

  it('一覧にないモジュール（ほかのパッケージ、入れ子の node_modules、リポジトリの外）が入ると失敗する', () => {
    const build = validU2Build();
    build.moduleLists.salesforce?.[0]?.modules.push(
      'node_modules/lodash/lodash.js',
      'node_modules/scheduler/node_modules/left-pad/index.js',
      '../outside/secret.ts',
      'tests/u2/helpers/fetch-mock.ts',
    );

    const errors = run(build, validPackageJson());

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('ビルドに決めた一覧の外のモジュールが入っています');
    for (const id of ['lodash', 'left-pad', '../outside/secret.ts', 'tests/u2/helpers']) {
      expect(errors[0]).toContain(id);
    }
  });
});
