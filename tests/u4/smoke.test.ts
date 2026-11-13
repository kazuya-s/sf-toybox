/**
 * U4 のテストの道具が動くことの確かめ（Step 2）。
 * U2 の入口を差し替えると、U4 が読み込む関数が差し替えに置き換わり、呼ばれた順が記録される。
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

describe('U4 のテストの道具（smoke）', () => {
  beforeEach(() => {
    u2.reset();
  });

  it('U2 の関数が差し替えに置き換わり、既定の結果・決めた失敗・呼ばれた順を返す', async () => {
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
