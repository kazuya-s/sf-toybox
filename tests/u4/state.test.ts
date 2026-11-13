/**
 * 追加の状態と安全策（src/changeset-add-assist/state.ts、security-design.md §4・§5、NFR3.3〜NFR3.8、NFR7.5）。
 * U2 の関数は tests/u4/helpers/u2-mock.ts で差し替える。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canAdd, createAddAssistStore } from '../../src/changeset-add-assist/state';
import { ok } from '../../src/shared/result';
import {
  TEST_CHANGE_SET_ID,
  TEST_CHANGE_SET_NAME,
  TEST_COMPONENT_TYPE,
  candidatesFixture,
} from './helpers/fixtures';
import {
  flushPromises,
  startedStore,
  storeWithSelection,
  watchBeforeUnload,
  watchReload,
} from './helpers/store';
import { u2 } from './helpers/u2-mock';

vi.mock('../../src/changeset/index', async (importOriginal) =>
  (await import('./helpers/u2-mock')).mockChangesetModule(await importOriginal()),
);
vi.mock('../../src/salesforce/index', async () =>
  (await import('./helpers/u2-mock')).mockSalesforceModule(),
);

/** basic の候補の componentKey（名前の順: Amount 001, Code 002, Note 005, Priority 004, Status 003） */
const KEY = {
  amount: '00N000000000001',
  code: '00N000000000002',
  status: '00N000000000003',
  priority: '00N000000000004',
  note: '00N000000000005',
} as const;

const addedKeys = () => u2.addComponent.calls.map((call) => call.componentKey);
const names = (list: { name: string }[] | undefined) => (list ?? []).map((item) => item.name);

describe('追加の状態（state）', () => {
  beforeEach(() => {
    u2.reset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('同時に始める: 3 つの呼び出しが、どれの結果も待たずに始まり、届いた順に反映される（NFR7.5）', async () => {
    const name = u2.getChangeSet.nextDeferred();
    const check = u2.checkAddPreconditions.nextDeferred();
    const candidates = u2.listAddCandidates.nextDeferred();
    const store = createAddAssistStore({
      changeSetId: TEST_CHANGE_SET_ID,
      componentType: TEST_COMPONENT_TYPE,
    });

    const started = store.start();

    expect(u2.callLog.map((entry) => entry.name)).toEqual([
      'getChangeSet',
      'checkAddPreconditions',
      'listAddCandidates',
    ]);
    expect(
      [u2.getChangeSet, u2.checkAddPreconditions, u2.listAddCandidates].map((fn) => fn.active),
    ).toEqual([1, 1, 1]);
    expect(u2.listAddCandidates.calls[0]).toEqual({
      changeSetId: TEST_CHANGE_SET_ID,
      componentType: TEST_COMPONENT_TYPE,
    });

    candidates.resolve(
      ok({ candidates: candidatesFixture('basic'), complete: true, failedPages: 0 }),
    );
    await flushPromises();
    expect(store.getState()).toMatchObject({ candidatesLoaded: true, changeSetNameLoaded: false });
    expect(names(store.getState().candidates)[0]).toBe('TestAmount__c');

    name.resolve(
      ok({ changeSetId: TEST_CHANGE_SET_ID, name: TEST_CHANGE_SET_NAME, status: 'open' }),
    );
    check.resolve(ok(undefined));
    await started;
    expect(store.getState()).toMatchObject({
      changeSetName: TEST_CHANGE_SET_NAME,
      preconditionsPassed: true,
      preconditionsLoading: false,
    });
    await store.start();
    expect(u2.callLog).toHaveLength(3);
  });

  it('名前と確認がそろうまで押せない: getChangeSet と checkAddPreconditions の両方が成功するまで canAdd は false（NFR3.6）', async () => {
    const name = u2.getChangeSet.nextDeferred();
    const check = u2.checkAddPreconditions.nextDeferred();
    const store = createAddAssistStore({
      changeSetId: TEST_CHANGE_SET_ID,
      componentType: TEST_COMPONENT_TYPE,
    });
    const started = store.start();
    await flushPromises();

    store.toggleSelection(KEY.amount);
    expect(store.getState().candidatesLoaded).toBe(true);
    expect(canAdd(store.getState())).toBe(false);

    name.resolve(
      ok({ changeSetId: TEST_CHANGE_SET_ID, name: TEST_CHANGE_SET_NAME, status: 'open' }),
    );
    await flushPromises();
    expect(canAdd(store.getState())).toBe(false);

    check.resolve(ok(undefined));
    await started;
    expect(canAdd(store.getState())).toBe(true);
    store.toggleSelection(KEY.amount);
    expect(canAdd(store.getState())).toBe(false);
  });

  it('止める理由: それぞれの失敗で canAdd が false になり、「もう一度試す」の成功でその理由だけが外れる（NFR3.6、BR1.2）', async () => {
    const cases = [
      { setup: () => u2.checkAddPreconditions.nextFail('sessionExpired'), retry: null },
      { setup: () => u2.checkAddPreconditions.nextFail('changeSetLocked'), retry: null },
      { setup: () => u2.checkAddPreconditions.nextFail('permissionDenied'), retry: null },
      { setup: () => u2.checkAddPreconditions.nextFail('timeout'), retry: 'preconditions' },
      { setup: () => u2.getChangeSet.nextFail('network'), retry: 'preconditions' },
      { setup: () => u2.listAddCandidates.nextFail('notFound'), retry: 'candidates' },
    ] as const;
    for (const { setup, retry } of cases) {
      u2.reset();
      setup();
      const store = await storeWithSelection([KEY.amount]);

      expect(store.getState().blockReasons).toEqual([expect.objectContaining({ retry })]);
      expect(canAdd(store.getState())).toBe(false);
    }

    u2.reset();
    const typeUnknown = await startedStore(null);
    expect(typeUnknown.getState()).toMatchObject({
      candidatesStatus: 'typeUnreadable',
      blockReasons: [{ source: 'componentType', kind: 'unexpectedResponse', retry: null }],
    });
    expect(u2.listAddCandidates.calls).toHaveLength(0);

    // 名前の取得と候補の読み込みが失敗し、それぞれのやり直しでその理由だけが外れる
    u2.reset();
    u2.getChangeSet.nextFail('timeout');
    u2.listAddCandidates.nextFail('network');
    const store = await startedStore();
    expect(store.getState().blockReasons.map((reason) => reason.source)).toEqual([
      'changeSet',
      'candidates',
    ]);

    await store.retryPreconditions();
    expect(store.getState().blockReasons.map((reason) => reason.source)).toEqual(['candidates']);
    await store.retryCandidates();
    expect(store.getState().blockReasons).toEqual([]);
    store.toggleSelection(KEY.code);
    expect(canAdd(store.getState())).toBe(true);
  });

  it('押したときだけ: 読み込みと選択では addComponent を呼ばず、runAdd で選んだものだけを名前の順に渡す（NFR3.3）', async () => {
    const store = await storeWithSelection([KEY.status, KEY.amount, KEY.note]);
    store.toggleSelection(KEY.code);
    store.toggleSelection(KEY.code);
    expect(u2.addComponent.calls).toHaveLength(0);

    await store.runAdd();

    expect(addedKeys()).toEqual([KEY.amount, KEY.note, KEY.status]);
    expect(u2.addComponent.calls[0]).toEqual({
      changeSetId: TEST_CHANGE_SET_ID,
      componentType: TEST_COMPONENT_TYPE,
      componentKey: KEY.amount,
    });
    expect(u2.addComponent.maxActive).toBe(1);
    expect(names(store.getState().result?.succeeded)).toEqual([
      'TestAmount__c',
      'TestNote__c',
      'TestStatus__c',
    ]);
  });

  it('二重に追加しない: 続けて 2 回 runAdd を呼んでも 1 件につき 1 回。adding と result のあいだは canAdd が false（NFR3.4）', async () => {
    const store = await storeWithSelection([KEY.amount, KEY.code]);
    const first = u2.addComponent.nextDeferred();

    const runs = [store.runAdd(), store.runAdd()];
    expect(store.getState().phase).toBe('adding');
    expect(canAdd(store.getState())).toBe(false);
    store.toggleSelection(KEY.note);
    expect(store.getState().selection.has(KEY.note)).toBe(false);

    first.resolve(ok(undefined));
    await Promise.all(runs);
    await store.runAdd();

    expect(addedKeys()).toEqual([KEY.amount, KEY.code]);
    expect(store.getState().phase).toBe('result');
    expect(canAdd(store.getState())).toBe(false);
  });

  it('失敗したら止める: 2 件目が失敗したら 3 件目以降を呼ばず、「試さなかったもの」に入れる（NFR3.5、BR3.3）', async () => {
    const store = await storeWithSelection([KEY.priority, KEY.note, KEY.code, KEY.amount]);
    u2.addComponent.next(ok(undefined)).nextFail('timeout');

    await store.runAdd();

    const { result } = store.getState();
    expect(addedKeys()).toEqual([KEY.amount, KEY.code]);
    expect(names(result?.succeeded)).toEqual(['TestAmount__c']);
    expect(result?.failed).toEqual([
      expect.objectContaining({
        candidate: expect.objectContaining({ name: 'TestCode__c' }),
        error: expect.objectContaining({ kind: 'timeout' }),
      }),
    ]);
    expect(names(result?.untried)).toEqual(['TestNote__c', 'TestPriority__c']);
    expect(result?.aborted).toBe(false);
  });

  it('離れるときの確認: 追加中だけ beforeunload が登録され、成功・失敗・中止のどれでも外れる。中止でもループが終わるまで残る（NFR3.7）', async () => {
    const watch = watchBeforeUnload();

    // 成功で終わる
    const success = await storeWithSelection([KEY.amount]);
    const pending = u2.addComponent.nextDeferred();
    const running = success.runAdd();
    expect(watch.isRegistered()).toBe(true);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    pending.resolve(ok(undefined));
    await running;
    expect(watch.isRegistered()).toBe(false);

    // 失敗で終わる
    const failure = await storeWithSelection([KEY.amount]);
    u2.addComponent.nextFail('network');
    await failure.runAdd();
    expect(watch.isRegistered()).toBe(false);

    // 中止の印で止まる
    const aborted = await storeWithSelection([KEY.amount, KEY.code, KEY.note]);
    const current = u2.addComponent.nextDeferred();
    const abortedRun = aborted.runAdd();
    aborted.abort();
    expect(aborted.isAbortRequested()).toBe(true);
    expect(watch.isRegistered()).toBe(true);
    current.resolve(ok(undefined));
    await abortedRun;

    expect(watch.isRegistered()).toBe(false);
    expect(watch.added()).toBe(3);
    expect(aborted.getState().result).toMatchObject({ aborted: true });
    expect(names(aborted.getState().result?.untried)).toEqual(['TestCode__c', 'TestNote__c']);
    const afterEnd = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterEnd);
    expect(afterEnd.defaultPrevented).toBe(false);
  });

  it('閉じたら読み込み直す: closeResult を何度呼んでも location.reload は 1 回。結果が出るまでは呼ばない（NFR3.8）', async () => {
    const reload = watchReload();
    const store = await storeWithSelection([KEY.amount]);

    store.closeResult();
    expect(reload).not.toHaveBeenCalled();

    await store.runAdd();
    store.closeResult();
    store.closeResult();
    store.closeResult();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
