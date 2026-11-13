/**
 * U2 の関数（getChangeSet・checkAddPreconditions・listAddCandidates・addComponent）の差し替え
 * （U4 unit-test-instructions.md「模擬と差し替えの決まり」）。実際の組織にはつながない。
 *
 * テストのファイルでは、次の 2 つの vi.mock でこの道具につなぐ（vi.mock は各ファイルで書く必要がある）。
 *
 *   vi.mock('<相対パス>/src/changeset/index', async (importOriginal) =>
 *     (await import('<相対パス>/tests/u4/helpers/u2-mock')).mockChangesetModule(await importOriginal()),
 *   );
 *   vi.mock('<相対パス>/src/salesforce/index', async () =>
 *     (await import('<相対パス>/tests/u4/helpers/u2-mock')).mockSalesforceModule(),
 *   );
 *
 * 1 件ずつ、成功・失敗の種類・遅れ（解決を待たせる）・例外を決められる。
 * 呼ばれた順・引数・同時に走っている数を記録する。
 */
import type { AddCandidates, AddRequest, OutboundChangeSet } from '../../../src/changeset/index';
import { fail, ok, type AppErrorKind, type Result } from '../../../src/shared/result';
import { candidatesFixture, TEST_CHANGE_SET_ID, TEST_CHANGE_SET_NAME } from './fixtures';

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

type Step<T> =
  | { kind: 'result'; result: Result<T> }
  | { kind: 'throw'; error: unknown }
  | { kind: 'deferred'; deferred: Deferred<Result<T>> };

export type U2FunctionName =
  'getChangeSet' | 'checkAddPreconditions' | 'listAddCandidates' | 'addComponent';

/** 呼ばれた順の記録（すべての関数で共通） */
const callLog: { name: U2FunctionName; arg: unknown }[] = [];

/** 1 つの関数の差し替え */
export class MockedU2Function<A, T> {
  readonly calls: A[] = [];
  active = 0;
  maxActive = 0;
  private queue: Step<T>[] = [];
  private fallback: Step<T>;

  constructor(
    private readonly name: U2FunctionName,
    private readonly makeDefault: () => Result<T>,
  ) {
    this.fallback = { kind: 'result', result: makeDefault() };
  }

  /** 次の 1 回の結果を決める */
  next(result: Result<T>): this {
    this.queue.push({ kind: 'result', result });
    return this;
  }

  /** 次の 1 回を失敗にする */
  nextFail(kind: AppErrorKind, message = 'test.failure'): this {
    return this.next(fail<T>(kind, message));
  }

  /** 次の 1 回で例外を投げる */
  nextThrow(error: unknown = new Error('unexpected failure in U2')): this {
    this.queue.push({ kind: 'throw', error });
    return this;
  }

  /** 次の 1 回を、テストが解決するまで待たせる */
  nextDeferred(): Deferred<Result<T>> {
    const deferred = createDeferred<Result<T>>();
    this.queue.push({ kind: 'deferred', deferred });
    return deferred;
  }

  /** 決めた結果がなくなったあとに、毎回返す結果 */
  always(result: Result<T>): this {
    this.fallback = { kind: 'result', result };
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.active = 0;
    this.maxActive = 0;
    this.queue = [];
    this.fallback = { kind: 'result', result: this.makeDefault() };
  }

  invoke = (arg: A): Promise<Result<T>> => {
    this.calls.push(arg);
    callLog.push({ name: this.name, arg });
    const step = this.queue.shift() ?? this.fallback;
    if (step.kind === 'throw') throw step.error;
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    const settle = () => {
      this.active -= 1;
    };
    const pending = step.kind === 'deferred' ? step.deferred.promise : Promise.resolve(step.result);
    return pending.finally(settle);
  };
}

export const u2 = {
  getChangeSet: new MockedU2Function<{ changeSetId: string }, OutboundChangeSet>(
    'getChangeSet',
    () => ok({ changeSetId: TEST_CHANGE_SET_ID, name: TEST_CHANGE_SET_NAME, status: 'open' }),
  ),
  checkAddPreconditions: new MockedU2Function<{ changeSetId: string }, void>(
    'checkAddPreconditions',
    () => ok(undefined),
  ),
  listAddCandidates: new MockedU2Function<
    { changeSetId: string; componentType: string },
    AddCandidates
  >('listAddCandidates', () =>
    ok({ candidates: candidatesFixture('basic'), complete: true, failedPages: 0 }),
  ),
  addComponent: new MockedU2Function<AddRequest, void>('addComponent', () => ok(undefined)),
  /** すべての関数の、呼ばれた順 */
  callLog,
  reset(): void {
    callLog.length = 0;
    u2.getChangeSet.reset();
    u2.checkAddPreconditions.reset();
    u2.listAddCandidates.reset();
    u2.addComponent.reset();
  },
};

/** src/changeset/index の差し替え。readSelectedComponentType など、ほかの書き出しは本物のまま */
export function mockChangesetModule<M extends object>(original: M): M {
  return {
    ...original,
    getChangeSet: u2.getChangeSet.invoke,
    checkAddPreconditions: u2.checkAddPreconditions.invoke,
    listAddCandidates: u2.listAddCandidates.invoke,
  };
}

/** src/salesforce/index の差し替え */
export function mockSalesforceModule(): { addComponent: typeof u2.addComponent.invoke } {
  return { addComponent: u2.addComponent.invoke };
}
