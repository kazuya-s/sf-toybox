/**
 * Checks that the U4 test tooling works (Step 2).
 * Stubbing the U2 entry replaces the functions U4 imports and records the call order.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChangeSet, listAddCandidates } from '../../src/changeset/index';
import { addComponent } from '../../src/salesforce/index';
import { TEST_CHANGE_SET_ID, TEST_COMPONENT_TYPE, candidatesFixture } from './helpers/fixtures';
import { u2 } from './helpers/u2-mock';

vi.mock('../../src/changeset/index', async (importOriginal) =>
  (await import('./helpers/u2-mock')).mockChangesetModule(await importOriginal()),
);
vi.mock('../../src/salesforce/index', async () =>
  (await import('./helpers/u2-mock')).mockSalesforceModule(),
);

describe('U4 test tooling (smoke)', () => {
  beforeEach(() => {
    u2.reset();
  });

  it('U2 functions are replaced by stubs returning the default result, set failures and call order', async () => {
    u2.addComponent.nextFail('timeout');

    const changeSet = await getChangeSet({ changeSetId: TEST_CHANGE_SET_ID });
    const candidates = await listAddCandidates({
      changeSetId: TEST_CHANGE_SET_ID,
      componentType: TEST_COMPONENT_TYPE,
    });
    const added = await addComponent({
      changeSetId: TEST_CHANGE_SET_ID,
      componentType: TEST_COMPONENT_TYPE,
      componentKey: '00N000000000001',
    });

    expect(changeSet).toMatchObject({ ok: true, value: { name: 'Test Change Set' } });
    expect(candidates).toMatchObject({ ok: true, value: { complete: true } });
    expect(added).toMatchObject({ ok: false, error: { kind: 'timeout' } });
    expect(u2.callLog.map((entry) => entry.name)).toEqual([
      'getChangeSet',
      'listAddCandidates',
      'addComponent',
    ]);
    expect(candidatesFixture('basic').every((candidate) => candidate.name.startsWith('Test'))).toBe(
      true,
    );
  });
});
