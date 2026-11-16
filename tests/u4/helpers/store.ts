/**
 * Helpers for testing the add state (state.ts). Used together with the U2 stub (u2-mock.ts).
 */
import { vi } from 'vitest';
import { createAddAssistStore, type AddAssistStore } from '../../../src/changeset-add-assist/state';
import { TEST_CHANGE_SET_ID, TEST_COMPONENT_TYPE } from './fixtures';

/** Creates the state and waits until loading finishes */
export async function startedStore(
  componentType: string | null = TEST_COMPONENT_TYPE,
): Promise<AddAssistStore> {
  const store = createAddAssistStore({ changeSetId: TEST_CHANGE_SET_ID, componentType });
  await store.start();
  return store;
}

/** Creates the state and selects componentKeys once loading finishes */
export async function storeWithSelection(keys: readonly string[]): Promise<AddAssistStore> {
  const store = await startedStore();
  for (const key of keys) store.toggleSelection(key);
  return store;
}

/** Watches registration and removal of window beforeunload */
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

/** Watches location.reload (the happy-dom reload is not run) */
export function watchReload() {
  return vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
}

/** Advances pending promise continuations */
export async function flushPromises(times = 5): Promise<void> {
  for (let index = 0; index < times; index += 1) await Promise.resolve();
}
