/**
 * Storage gateway that uses only chrome.storage.local (BR1.1, NFR1.2, security-design.md §1).
 * Never uses synced storage (chrome.storage.sync). Failures are returned as Result storageFailed.
 */
import { fail, ok, type Result } from '../shared/result';

function describeError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

/** Reads the value of a key. Returns undefined when there is none */
export function readLocal(key: string): Promise<Result<unknown>> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(key, (items) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          resolve(
            fail('storageFailed', 'chrome.storage.local.get failed', lastError.message ?? null),
          );
          return;
        }
        resolve(ok(items?.[key]));
      });
    } catch (error) {
      resolve(fail('storageFailed', 'chrome.storage.local.get threw', describeError(error)));
    }
  });
}

/** Writes a value to a key */
export function writeLocal(key: string, value: unknown): Promise<Result<void>> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [key]: value }, () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          resolve(
            fail('storageFailed', 'chrome.storage.local.set failed', lastError.message ?? null),
          );
          return;
        }
        resolve(ok(undefined));
      });
    } catch (error) {
      resolve(fail('storageFailed', 'chrome.storage.local.set threw', describeError(error)));
    }
  });
}
