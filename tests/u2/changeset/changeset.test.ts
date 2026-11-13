import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkAddPreconditions,
  getChangeSet,
  listAddCandidates,
  listComponents,
} from '../../../src/changeset/changeset';
import { ERROR_MESSAGES } from '../../../src/salesforce/markers';
import type { Result } from '../../../src/shared/result';
import { html, installFetchMock, redirect } from '../helpers/fetch-mock';
import { TEST_CHANGE_SET_ID, readFixture, useSalesforceLocation } from '../helpers/location';
import {
  ADD_PAGE_1,
  ADD_PAGE_2,
  ADD_PAGE_ANY,
  DETAIL_PAGE_1,
  DETAIL_PAGE_2,
  DETAIL_PAGE_3,
} from '../helpers/paths';

const changeSetId = TEST_CHANGE_SET_ID;

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`成功を期待しました: ${result.error.kind}`);
  return result.value;
}

function errorOf<T>(result: Result<T>) {
  if (result.ok) throw new Error('失敗を期待しました');
  return result.error;
}

describe('変更セットの読み込み（ChangeSet、C4・C5）', () => {
  beforeEach(() => {
    useSalesforceLocation();
  });

  it('ID の形が違うと、送らずに notFound を返す', async () => {
    const mock = installFetchMock();

    const results: Result<unknown>[] = [
      await listComponents({ changeSetId: '../x' }),
      await getChangeSet({ changeSetId: '0A2' }),
      await checkAddPreconditions({ changeSetId: '' }),
      await listAddCandidates({ changeSetId: 'not-an-id-value', componentType: 'ApexClass' }),
      await listAddCandidates({ changeSetId, componentType: '' }),
    ];

    expect(results.map((result) => errorOf(result).kind)).toEqual([
      'notFound',
      'notFound',
      'notFound',
      'notFound',
      'notFound',
    ]);
    expect(mock.calls).toEqual([]);
  });

  it('名前・状態・行を読み、親オブジェクトが空なら null にする（BR2.4、BR2.5）', async () => {
    installFetchMock().route(DETAIL_PAGE_1, html(readFixture('detail-single.html')));

    const result = valueOf(await listComponents({ changeSetId }));

    expect(result).toEqual({
      changeSet: { changeSetId, name: 'TestChangeSet', status: 'open' },
      components: [
        { componentType: 'Apex Class', apiName: 'TestClass', parentObject: null },
        { componentType: 'Custom Field', apiName: 'Field_A__c', parentObject: 'Test__c' },
        { componentType: 'Visualforce Page', apiName: 'TestPage', parentObject: null },
      ],
      complete: true,
      failedPages: 0,
    });
  });

  it('ページの境目の重なりを 1 件にまとめ、最初に読めた順を保つ（BR2.6）', async () => {
    installFetchMock()
      .route(DETAIL_PAGE_1, html(readFixture('detail-page1.html')))
      .route(DETAIL_PAGE_2, html(readFixture('detail-page2.html')))
      .route(DETAIL_PAGE_3, html(readFixture('detail-page3.html')));

    const result = valueOf(await listComponents({ changeSetId }));

    expect(result.components.map((component) => component.apiName)).toEqual([
      'TestClassA',
      'Field_A__c',
      'TestPageB',
      'TestTriggerC',
      'TestClassD',
    ]);
    expect(result.components[2]?.parentObject).toBeNull();
    expect(result.complete).toBe(true);
  });

  it('表の列が欠けたページからは推測で取り出さない（BR2.7）', async () => {
    const mock = installFetchMock()
      .route(DETAIL_PAGE_1, [
        html(readFixture('detail-missing-column.html')),
        html(readFixture('detail-page1.html')),
      ])
      .route(DETAIL_PAGE_2, html(readFixture('detail-missing-column.html')));

    const firstBroken = await listComponents({ changeSetId });
    const laterBroken = valueOf(await listComponents({ changeSetId }));

    expect(errorOf(firstBroken)).toEqual({
      kind: 'unexpectedResponse',
      message: ERROR_MESSAGES.missingColumn,
      detail: null,
    });
    expect(laterBroken.components.map((component) => component.apiName)).toEqual([
      'TestClassA',
      'Field_A__c',
    ]);
    expect(laterBroken).toMatchObject({ complete: false, failedPages: 2 });
    expect(mock.count(DETAIL_PAGE_3)).toBe(0);
  });

  it('状態の open・uploaded・unknown を読み分ける（BR2.4）', async () => {
    installFetchMock().route(DETAIL_PAGE_1, [
      html(readFixture('detail-single.html')),
      html(readFixture('detail-uploaded.html')),
      html(readFixture('detail-unknown.html')),
      html('<div class="componentList"></div>'),
    ]);

    const statuses = [];
    for (let index = 0; index < 3; index += 1) {
      statuses.push(valueOf(await getChangeSet({ changeSetId })).status);
    }
    const noName = await getChangeSet({ changeSetId });

    expect(statuses).toEqual(['open', 'uploaded', 'unknown']);
    expect(errorOf(noName).message).toBe(ERROR_MESSAGES.missingName);
  });

  it('checkAddPreconditions: uploaded は changeSetLocked、フォームなしは失敗、unknown は止めない（BR3.1）', async () => {
    const mock = installFetchMock()
      .route(DETAIL_PAGE_1, [
        html(readFixture('detail-uploaded.html')),
        html(readFixture('detail-single.html')),
        html(readFixture('detail-unknown.html')),
      ])
      .route(ADD_PAGE_ANY, [
        html(readFixture('add-no-form.html')),
        html(readFixture('add-page1.html')),
      ]);

    const locked = await checkAddPreconditions({ changeSetId });
    expect(mock.count(ADD_PAGE_ANY)).toBe(0);
    const noForm = await checkAddPreconditions({ changeSetId });
    const unknown = await checkAddPreconditions({ changeSetId });

    expect(errorOf(locked)).toEqual({
      kind: 'changeSetLocked',
      message: ERROR_MESSAGES.changeSetLocked,
      detail: null,
    });
    expect(errorOf(noForm)).toEqual({
      kind: 'unexpectedResponse',
      message: ERROR_MESSAGES.missingAddForm,
      detail: null,
    });
    expect(unknown).toEqual({ ok: true, value: undefined });
  });

  it('checkAddPreconditions: ログイン切れ・権限なしをその種類で返す', async () => {
    installFetchMock()
      .route(DETAIL_PAGE_1, [
        redirect(),
        html(readFixture('permission-denied.html')),
        html(readFixture('detail-single.html')),
      ])
      .route(ADD_PAGE_ANY, html(readFixture('permission-denied.html')));

    const kinds = [];
    for (let index = 0; index < 3; index += 1) {
      kinds.push(errorOf(await checkAddPreconditions({ changeSetId })).kind);
    }

    expect(kinds).toEqual(['sessionExpired', 'permissionDenied', 'permissionDenied']);
  });

  it('listAddCandidates: 2 ページの候補をまとめ、親オブジェクトがない行は null（BR3.6）', async () => {
    installFetchMock()
      .route(ADD_PAGE_1, html(readFixture('add-page1.html')))
      .route(ADD_PAGE_2, html(readFixture('add-page2.html')));

    const result = valueOf(await listAddCandidates({ changeSetId, componentType: 'CustomField' }));

    expect(result).toEqual({
      candidates: [
        {
          componentKey: '00N000000000001',
          name: 'Field_A__c',
          parentObject: 'Account',
          typeLabel: 'カスタム項目',
        },
        {
          componentKey: '00N000000000002',
          name: 'Field_B__c',
          parentObject: null,
          typeLabel: 'カスタム項目',
        },
        {
          componentKey: '00N000000000003',
          name: 'Field_C__c',
          parentObject: 'Test__c',
          typeLabel: 'カスタム項目',
        },
      ],
      complete: true,
      failedPages: 0,
    });
  });
});
