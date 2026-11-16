import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkBuild } from '../../../scripts/check-manifest.mjs';
import { validBuild, writeBuild, type FakeBuild } from '../../u1/fixtures/build-output';

/** Temporary folders are created inside the project (node_modules/.cache) and removed after the tests */
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

/** Fake build output with modules shaped like a real build */
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

describe('Checks U2 added to the manifest script (dependencies and module lists, NFR3.4)', () => {
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

  it('passes with only the chosen dependencies and listed modules', () => {
    expect(run(validU2Build(), validPackageJson())).toEqual([]);
  });

  it('fails when one is added to dependencies or optionalDependencies', () => {
    const packageJson = validPackageJson();
    packageJson.dependencies = { ...packageJson.dependencies, lodash: '^4.0.0' };
    packageJson.optionalDependencies = { axios: '^1.0.0' };

    expect(run(validU2Build(), packageJson)).toEqual([
      'package.json dependencies has dependencies outside the chosen list: lodash',
      'package.json optionalDependencies has dependencies outside the chosen list: axios',
    ]);
  });

  it('fails when added to peerDependencies, and when package.json is missing', () => {
    const packageJson = validPackageJson();
    packageJson.peerDependencies = { jquery: '^3.0.0' };

    expect(run(validU2Build(), packageJson)).toEqual([
      'package.json peerDependencies has dependencies outside the chosen list: jquery',
    ]);
    const missing = checkBuild({
      ...writeBuild(root, validU2Build()),
      packageJson: join(root, 'missing.json'),
    }).errors;
    expect(missing).toEqual([expect.stringContaining('missing.json is missing')]);
  });

  it('fails when unlisted modules (other packages, nested node_modules, outside the repo) are bundled', () => {
    const build = validU2Build();
    build.moduleLists.salesforce?.[0]?.modules.push(
      'node_modules/lodash/lodash.js',
      'node_modules/scheduler/node_modules/left-pad/index.js',
      '../outside/secret.ts',
      'tests/u2/helpers/fetch-mock.ts',
    );

    const errors = run(build, validPackageJson());

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('The build contains modules outside the chosen list');
    for (const id of ['lodash', 'left-pad', '../outside/secret.ts', 'tests/u2/helpers']) {
      expect(errors[0]).toContain(id);
    }
  });
});
