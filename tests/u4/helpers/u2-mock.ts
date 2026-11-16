/**
 * Stubs for U2 functions (getChangeSet, checkAddPreconditions, listAddCandidates, addComponent)
 * (U4 unit-test-instructions.md "Mock and stub rules"). Never connects to a real org.
 *
 * Test files hook into this helper with these two vi.mock calls (vi.mock must be written in each file):
 *
 *   vi.mock('<relative path>/src/changeset/index', async (importOriginal) =>
 *     (await import('<relative path>/tests/u4/helpers/u2-mock')).mockChangesetModule(await importOriginal()),
 *   );
 *   vi.mock('<relative path>/src/salesforce/index', async () =>
 *     (await import('<relative path>/tests/u4/helpers/u2-mock')).mockSalesforceModule(),
 *   );
 *
 * Each call can be set to succeed, fail with a kind, be delayed (held until resolved) or throw.
 * Records call order, arguments and the number running at once.
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

/** Call order record (shared by all functions) */
const callLog: { name: U2FunctionName; arg: unknown }[] = [];

/** Stub for one function */
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

  /** Sets the result of the next call */
  next(result: Result<T>): this {
    this.queue.push({ kind: 'result', result });
    return this;
  }

  /** Makes the next call fail */
  nextFail(kind: AppErrorKind, message = 'test.failure'): this {
    return this.next(fail<T>(kind, message));
  }

  /** Makes the next call throw */
  nextThrow(error: unknown = new Error('unexpected failure in U2')): this {
    this.queue.push({ kind: 'throw', error });
    return this;
  }

  /** Holds the next call until the test resolves it */
  nextDeferred(): Deferred<Result<T>> {
    const deferred = createDeferred<Result<T>>();
    this.queue.push({ kind: 'deferred', deferred });
    return deferred;
  }

  /** Result returned every time once the set results run out */
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
  /** Call order of all functions */
  callLog,
  reset(): void {
    callLog.length = 0;
    u2.getChangeSet.reset();
    u2.checkAddPreconditions.reset();
    u2.listAddCandidates.reset();
    u2.addComponent.reset();
  },
};

/** Stub for src/changeset/index. Other exports such as readSelectedComponentType stay real */
export function mockChangesetModule<M extends object>(original: M): M {
  return {
    ...original,
    getChangeSet: u2.getChangeSet.invoke,
    checkAddPreconditions: u2.checkAddPreconditions.invoke,
    listAddCandidates: u2.listAddCandidates.invoke,
  };
}

/** Stub for src/salesforce/index */
export function mockSalesforceModule(): { addComponent: typeof u2.addComponent.invoke } {
  return { addComponent: u2.addComponent.invoke };
}
