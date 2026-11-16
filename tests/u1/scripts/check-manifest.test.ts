import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkBuild } from '../../../scripts/check-manifest.mjs';
import { validBuild, writeBuild, type FakeBuild } from '../fixtures/build-output';

/** Temporary folders are created inside the project (node_modules/.cache) and removed after the tests */
const TEMP_PARENT = resolve(process.cwd(), 'node_modules/.cache/sftoybox-check-manifest');

describe('Manifest check script (check-manifest, cicd-pipeline.md stages 5-6)', () => {
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

  it('passes for a valid build (license comments and namespace strings do not count as external URLs)', () => {
    expect(run(validBuild())).toEqual([]);
  });

  it('fails on extra permissions, host_permissions, a CSP, and permissions missing from the doc', () => {
    const build = validBuild();
    build.manifest.permissions = ['storage', 'tabs'];
    build.manifest.host_permissions = ['https://*.salesforce.com/*'];
    build.manifest.content_security_policy = { extension_pages: "script-src 'self'" };

    const errors = run(build);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Permissions not allowed: tabs'),
        expect.stringContaining('host_permissions'),
        expect.stringContaining('content_security_policy'),
        expect.stringContaining('has no entry for permission `tabs`'),
      ]),
    );
  });

  it('fails when matches include a domain outside Salesforce', () => {
    const build = validBuild();
    build.manifest.content_scripts[0]?.matches.push('https://*.example.com/*');
    build.manifest.web_accessible_resources[0]?.matches.push('<all_urls>');

    const errors = run(build);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('content_scripts[0] matches include non-Salesforce hosts'),
        expect.stringContaining('web_accessible_resources[0] matches include non-Salesforce hosts'),
      ]),
    );
  });

  it('fails when a file the page-size bar loads is missing from web_accessible_resources', () => {
    const build = validBuild();
    const war = build.manifest.web_accessible_resources[0];
    if (war) war.resources = ['page-size-bar.js'];

    const errors = run(build);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'chunks/react-abc123.js loaded by the page-size bar is not listed in web_accessible_resources',
        ),
        expect.stringContaining(
          'assets/bar.css loaded by the page-size bar is not listed in web_accessible_resources',
        ),
      ]),
    );
  });

  it.each([
    ['content-scripts/salesforce.js', 'import("https://cdn.example.com/x.js");'],
    ['assets/bar.css', '@import url("https://fonts.example.com/font.css");'],
    ['assets/bar.css', '.x{background:url(https://cdn.example.com/a.png)}'],
    ['options.html', '<link rel="stylesheet" href="https://cdn.example.com/slds.css">'],
  ])('fails when something loads from an external URL: %s', (file, content) => {
    const build = validBuild();
    build.files[file] = `${build.files[file] ?? ''}\n${content}`;

    const errors = run(build);

    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) expect(error).toContain(`${file} loads from an external URL`);
  });

  it('fails when React is in the entry', () => {
    const build = validBuild();
    build.moduleLists.salesforce?.[0]?.modules.push(
      'node_modules/react/cjs/react.production.js',
      'node_modules/react-dom/client.js',
    );

    expect(run(build)).toEqual([expect.stringContaining('React is in the entry')]);
  });
});
