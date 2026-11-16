/**
 * Checks U4 added to the manifest script (U4 cicd-pipeline.md stages 5-6, NFR3.2, NFR7.2).
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkBuild } from '../../../scripts/check-manifest.mjs';
import { validBuild, writeBuild, type FakeBuild } from '../../u1/fixtures/build-output';

/** Temporary folders are created inside the project (node_modules/.cache) and removed after the tests */
const TEMP_PARENT = resolve(process.cwd(), 'node_modules/.cache/sftoybox-check-manifest-u4');

/** Fake build output in which the add-assist chunk loads a React chunk and CSS */
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

describe('Checks U4 added to the manifest script', () => {
  let root: string;

  beforeEach(() => {
    mkdirSync(TEMP_PARENT, { recursive: true });
    root = mkdtempSync(join(TEMP_PARENT, 'case-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Writes to a different folder each time so leftovers from earlier writes are never read */
  function run(build: FakeBuild): string[] {
    return checkBuild(writeBuild(mkdtempSync(join(root, 'run-')), build)).errors;
  }

  it('passes when the add-assist chunk and what it loads are all in web_accessible_resources', () => {
    expect(run(validU4Build())).toEqual([]);
  });

  it('fails when one file the add-assist chunk loads is missing, or the chunk is not in the build', () => {
    const build = validU4Build();
    const war = build.manifest.web_accessible_resources[0];
    if (war) war.resources = war.resources.filter((file) => file !== 'assets/add-assist.css');

    expect(run(build)).toEqual([
      'assets/add-assist.css loaded by the add assistant is not listed in web_accessible_resources',
    ]);

    const missing = validU4Build();
    delete missing.viteManifests['changeset-add-assist'];
    expect(run(missing)).toEqual([
      'The Vite chunk lists have no add assistant chunk (changeset-add-assist)',
    ]);
  });

  it('fails the stage 6 check when the add-assist widget (with React) is statically in the entry', () => {
    const build = validU4Build();
    build.moduleLists.salesforce?.[0]?.modules.push(
      'src/changeset-add-assist/mount.tsx',
      'entrypoints/changeset-add-assist.ts',
      'node_modules/react/index.js',
    );

    const errors = run(build);

    expect(errors).toEqual([
      expect.stringContaining('React is in the entry'),
      expect.stringContaining('The add-assist widget is in the entry'),
    ]);
    expect(errors[1]).toContain('src/changeset-add-assist/mount.tsx');
    expect(errors[1]).not.toContain('load.ts');
  });
});
