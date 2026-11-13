/**
 * 追加の状態（state.ts）のテストの道具。U2 の差し替え（u2-mock.ts）と合わせて使う。
 */
import { vi } from 'vitest';
import { createAddAssistStore, type AddAssistStore } from '../../../src/changeset-add-assist/state';
import { TEST_CHANGE_SET_ID, TEST_COMPONENT_TYPE } from './fixtures';

/** 状態を作り、読み込みが終わるまで待つ */
export async function startedStore(
  componentType: string | null = TEST_COMPONENT_TYPE,
): Promise<AddAssistStore> {
  const store = createAddAssistStore({ changeSetId: TEST_CHANGE_SET_ID, componentType });
  await store.start();
  return store;
}

/** 状態を作り、読み込み終わったら componentKey を選ぶ */
export async function storeWithSelection(keys: readonly string[]): Promise<AddAssistStore> {
  const store = await startedStore();
  for (const key of keys) store.toggleSelection(key);
  return store;
}

/** window の beforeunload の登録と解除を見張る */
export function watchBeforeUnload(): {
  added: () => number;
  removed: () => number;
  isRegistered: () => boolean;
} {
  const addSpy = vi.spyOn(window, 'addEventListener');
  const removeSpy = vi.spyOn(window, 'removeEventListener');
  const count = (spy: typeof addSpy | typeof removeSpy) =>
    spy.mock.calls.filter(([type]) => type === 'beforeunload').length;
  return {
    added: () => count(addSpy),
    removed: () => count(removeSpy),
    isRegistered: () => count(addSpy) > count(removeSpy),
  };
}

/** location.reload を見張る（happy-dom の読み込み直しは動かさない） */
export function watchReload() {
  return vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
}

/** たまっている Promise の続きを進める */
export async function flushPromises(times = 5): Promise<void> {
  for (let index = 0; index < times; index += 1) await Promise.resolve();
}
