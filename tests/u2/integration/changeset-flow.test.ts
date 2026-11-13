/**
 * U2 の結合テスト。入口（src/changeset/index.ts・src/salesforce/index.ts）を、fetch の差し替えだけで動かす。
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

/** ディレクトリの中の .ts ファイルを集める */
function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('U2 の入口からの流れ（結合テスト）', () => {
  beforeEach(() => {
    useSalesforceLocation();
  });

  it('3 ページの変更セットを読み、進み具合と 1 つにまとめた結果が返る', async () => {
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

  it('2 ページ目でログインが切れると、読めた分が complete: false で返る', async () => {
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

  it('追加の前の確認から、候補の読み込み・追加・読み直しまでが通る', async () => {
    routeAddFlow();

    const { preconditions, candidates, target, added } = await runAddFlow();

    expect(preconditions).toEqual({ ok: true, value: undefined });
    expect(candidates.ok && candidates.value.candidates).toHaveLength(3);
    expect(target?.name).toBe('Field_C__c');
    expect(added).toEqual({ ok: true, value: undefined });
  });

  it('送り先はすべて location.origin の中である（NFR1.1、NFR4.1）', async () => {
    const mock = routeAddFlow();

    await runAddFlow();

    expect(mock.calls.length).toBeGreaterThan(0);
    for (const call of mock.calls) {
      expect(new URL(call.url).origin).toBe(TEST_ORIGIN);
      expect(call.credentials).toBe('same-origin');
    }
  });

  it('どの失敗でも例外が外に出ず、失敗の Result が返る（NFR5.1）', async () => {
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

  it('U2 のコードは U1 の部品（設定・エラーの記録・保存）を読み込まない（C6）', () => {
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
        expect(specifier, `${file} の import`).toMatch(allowed);
        expect(specifier).not.toMatch(/settings|errors|storage/);
      }
    }
  });
});
