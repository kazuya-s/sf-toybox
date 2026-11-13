/**
 * 追加の状態の、失敗の扱いと記録（src/changeset-add-assist/state.ts、NFR1.2、NFR5.1、BR1.4、BR3.7）。
 * エラーの記録は U1 の本物の recordError（chrome.storage.local の模擬に書く）を使う。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canAdd, UNEXPECTED_EXCEPTION_MESSAGE } from '../../src/changeset-add-assist/state';
import { ok } from '../../src/shared/result';
import { mockState } from '../u1/helpers/chrome-mock';
import { TEST_CHANGE_SET_NAME, candidatesFixture } from './helpers/fixtures';
import { startedStore, storeWithSelection } from './helpers/store';
import { u2 } from './helpers/u2-mock';

vi.mock('../../src/changeset/index', async (importOriginal) =>
  (await import('./helpers/u2-mock')).mockChangesetModule(await importOriginal()),
);
vi.mock('../../src/salesforce/index', async () =>
  (await import('./helpers/u2-mock')).mockSalesforceModule(),
);

type LoggedEntry = Record<string, unknown>;

function errorLog(): LoggedEntry[] {
  return (mockState().local.errorLog as LoggedEntry[] | undefined) ?? [];
}

describe('追加の状態の失敗の扱い（state-errors）', () => {
  beforeEach(() => {
    u2.reset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('失敗を外に出さない: U2 の関数が例外を投げても外に出ず、unexpectedResponse として扱う（NFR5.1）', async () => {
    u2.getChangeSet.nextThrow();
    u2.checkAddPreconditions.nextThrow(new TypeError('broken'));
    u2.listAddCandidates.nextThrow();

    const store = await startedStore();

    expect(store.getState().blockReasons).toEqual([
      { source: 'changeSet', kind: 'unexpectedResponse', retry: 'preconditions' },
      { source: 'preconditions', kind: 'unexpectedResponse', retry: 'preconditions' },
      { source: 'candidates', kind: 'unexpectedResponse', retry: 'candidates' },
    ]);

    await store.retryPreconditions();
    await store.retryCandidates();
    store.toggleSelection('00N000000000001');
    u2.addComponent.nextThrow();
    await expect(store.runAdd()).resolves.toBeUndefined();
    expect(store.getState().result?.failed[0]?.error).toEqual({
      kind: 'unexpectedResponse',
      message: UNEXPECTED_EXCEPTION_MESSAGE,
      detail: null,
    });
  });

  it('記録の中身: 記録はツールの識別子・種類・文言の識別子（と時刻）だけで、候補や変更セットの名前を含まない（NFR1.2、BR3.7）', async () => {
    u2.checkAddPreconditions.nextFail('permissionDenied');
    u2.listAddCandidates.next(
      ok({ candidates: candidatesFixture('basic'), complete: false, failedPages: 1 }),
    );
    const store = await storeWithSelection(['00N000000000001']);
    await store.retryPreconditions();
    u2.addComponent.nextFail('timeout');
    await store.runAdd();

    await vi.waitFor(() => expect(errorLog()).toHaveLength(3));
    const entries = errorLog();
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(['at', 'kind', 'messageKey', 'toolId']);
      expect(entry.toolId).toBe('changeset-add-assist');
    }
    expect(entries[0]).toMatchObject({
      kind: 'timeout',
      messageKey: 'errorLog.addAssistAddFailed',
    });
    expect(entries.map((entry) => [entry.kind, entry.messageKey])).toEqual(
      expect.arrayContaining([
        ['unexpected', 'errorLog.addAssistCandidatesPartial'],
        ['permissionDenied', 'errorLog.addAssistPreconditionsFailed'],
      ]),
    );
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(TEST_CHANGE_SET_NAME);
    expect(serialized).not.toContain('TestAmount__c');
  });

  it('候補が complete: false なら読めた分を出し、candidatesLoaded は true で、追加できる（BR1.4）', async () => {
    u2.listAddCandidates.next(
      ok({ candidates: candidatesFixture('noParent'), complete: false, failedPages: 2 }),
    );

    const store = await storeWithSelection(['01p000000000003']);

    expect(store.getState()).toMatchObject({ candidatesStatus: 'partial', candidatesLoaded: true });
    expect(store.getState().candidates.map((candidate) => candidate.name)).toEqual([
      'TestHelper',
      'TestServiceA',
      'TestServiceB',
    ]);
    expect(canAdd(store.getState())).toBe(true);
    await store.runAdd();
    expect(store.getState().result?.succeeded).toHaveLength(1);
  });

  it('候補の読み込みの sessionExpired は、やり直しなしの止める理由になる（BR1.4）', async () => {
    u2.listAddCandidates.nextFail('sessionExpired');

    const store = await storeWithSelection(['00N000000000001']);

    expect(store.getState()).toMatchObject({
      candidatesStatus: 'error',
      candidatesLoaded: false,
      blockReasons: [{ source: 'candidates', kind: 'sessionExpired', retry: null }],
    });
    expect(store.getState().candidates).toEqual([]);
    expect(canAdd(store.getState())).toBe(false);
  });

  it('追加の結果の unexpectedResponse は「追加できなかったもの」に理由つきで入り、残りは試さない（U2 BR3.3）', async () => {
    const store = await storeWithSelection(['00N000000000001', '00N000000000002']);
    u2.addComponent.nextFail('unexpectedResponse', 'changeset.addNotConfirmed');

    await store.runAdd();

    const { result } = store.getState();
    expect(result?.failed).toEqual([
      expect.objectContaining({
        error: { kind: 'unexpectedResponse', message: 'changeset.addNotConfirmed', detail: null },
      }),
    ]);
    expect(result?.untried.map((candidate) => candidate.name)).toEqual(['TestCode__c']);
    expect(u2.addComponent.calls).toHaveLength(1);
  });
});
