/**
 * chrome.storage.local だけを使う保存の窓口（BR1.1、NFR1.2、security-design.md §1）。
 * 同期の保存領域（chrome.storage.sync）は使わない。失敗は Result の storageFailed で返す。
 */
import { fail, ok, type Result } from '../shared/result';

function describeError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

/** キーの値を読む。値がないときは undefined を返す */
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

/** キーに値を書く */
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
