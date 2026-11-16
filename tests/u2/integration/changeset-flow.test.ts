/**
 * U2 integration test. Drives the entry points (src/changeset/index.ts, src/salesforce/index.ts) with only fetch stubbed.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkAddPreconditions,
  getChangeSet,
  listAddCandidates,
  listComponents,
  type LoadProgress,
} from '../../../src/changeset';
import { addComponent } from '../../../src/salesforce';
import {
  html,
  installFetchMock,
  networkError,
  redirect,
  type MockReply,
} from '../helpers/fetch-mock';
import {
  TEST_CHANGE_SET_ID,
  TEST_ORIGIN,
  readFixture,
  useSalesforceLocation,
} from '../helpers/location';
import {
  ADD_FORM_ACTION,
  ADD_PAGE_1,
  ADD_PAGE_2,
  ADD_PAGE_ANY,
  DETAIL_PAGE_1,
  DETAIL_PAGE_2,
  DETAIL_PAGE_3,
} from '../helpers/paths';

const changeSetId = TEST_CHANGE_SET_ID;

function routeAddFlow() {
  return installFetchMock()
    .route(DETAIL_PAGE_1, [
      html(readFixture('detail-single.html')),
      html(readFixture('detail-after-add.html')),
    ])
    .route(ADD_PAGE_ANY, html(readFixture('add-page1.html')))
    .route(ADD_PAGE_1, html(readFixture('add-page1.html')))
    .route(ADD_PAGE_2, html(readFixture('add-page2.html')))
    .route(ADD_FORM_ACTION, redirect(), 'POST');
}

async function runAddFlow() {
  const preconditions = await checkAddPreconditions({ changeSetId });
  const candidates = await listAddCandidates({ changeSetId, componentType: 'CustomField' });
  const target = candidates.ok ? candidates.value.candidates[2] : undefined;
  const added = await addComponent({
    changeSetId,
    componentType: 'CustomField',
    componentKey: target?.componentKey ?? '',
  });
  return { preconditions, candidates, target, added };
}

/** Collects the .ts files in a directory */
function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('Flow from the U2 entry points (integration test)', () => {
  beforeEach(() => {
    useSalesforceLocation();
  });

  it('reads a three-page change set and returns progress and the merged result', async () => {
    installFetchMock()
      .route(DETAIL_PAGE_1, html(readFixture('detail-page1.html')))
      .route(DETAIL_PAGE_2, html(readFixture('detail-page2.html')))
      .route(DETAIL_PAGE_3, html(readFixture('detail-page3.html')));
    const progress: LoadProgress[] = [];

    const result = await listComponents({
      changeSetId,
      onProgress: (value) => progress.push(value),
    });

    expect(result.ok && result.value.components).toHaveLength(5);
    expect(result.ok && result.value.complete).toBe(true);
    expect(progress.map((value) => value.loadedPages)).toEqual([1, 2, 3]);
  });

  it('when the session expires on page 2, returns what was read with complete: false', async () => {
    installFetchMock()
      .route(DETAIL_PAGE_1, html(readFixture('detail-page1.html')))
      .route(DETAIL_PAGE_2, html(readFixture('login.html')));

    const result = await listComponents({ changeSetId });

    expect(result).toEqual({
      ok: true,
      value: {
        changeSet: { changeSetId, name: 'TestChangeSet', status: 'open' },
        components: [
          { componentType: 'Apex Class', apiName: 'TestClassA', parentObject: null },
          { componentType: 'Custom Field', apiName: 'Field_A__c', parentObject: 'Test__c' },
        ],
        complete: false,
        failedPages: 2,
      },
    });
  });

  it('runs through the pre-add check, loading candidates, adding and the reload', async () => {
    routeAddFlow();

    const { preconditions, candidates, target, added } = await runAddFlow();

    expect(preconditions).toEqual({ ok: true, value: undefined });
    expect(candidates.ok && candidates.value.candidates).toHaveLength(3);
    expect(target?.name).toBe('Field_C__c');
    expect(added).toEqual({ ok: true, value: undefined });
  });

  it('every destination is within location.origin (NFR1.1, NFR4.1)', async () => {
    const mock = routeAddFlow();

    await runAddFlow();

    expect(mock.calls.length).toBeGreaterThan(0);
    for (const call of mock.calls) {
      expect(new URL(call.url).origin).toBe(TEST_ORIGIN);
      expect(call.credentials).toBe('same-origin');
    }
  });

  it('no failure throws; each returns a failed Result (NFR5.1)', async () => {
    const failures: MockReply[] = [
      networkError(),
      redirect(),
      html('<p>error</p>', 500),
      html(readFixture('permission-denied.html')),
      html('<p>unexpected</p>'),
    ];

    for (const failure of failures) {
      installFetchMock().fallback(() => failure);
      const results = await Promise.all([
        listComponents({ changeSetId }),
        getChangeSet({ changeSetId }),
        checkAddPreconditions({ changeSetId }),
        listAddCandidates({ changeSetId, componentType: 'CustomField' }),
        addComponent({
          changeSetId,
          componentType: 'CustomField',
          componentKey: '00N000000000003',
        }),
      ]);
      for (const result of results) expect(result.ok).toBe(false);
    }
  });

  it('U2 code never imports U1 parts (settings, error log, storage) (C6)', () => {
    const root = resolve(process.cwd(), 'src');
    const files = [
      ...listSourceFiles(join(root, 'salesforce')),
      ...listSourceFiles(join(root, 'changeset')),
    ];
    const allowed = /^(\.\/|\.\.\/shared\/result$|\.\.\/salesforce\/|\.\.\/changeset\/)/;

    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] ?? '');
      for (const specifier of specifiers) {
        expect(specifier, `import in ${file}`).toMatch(allowed);
        expect(specifier).not.toMatch(/settings|errors|storage/);
      }
    }
  });
});
