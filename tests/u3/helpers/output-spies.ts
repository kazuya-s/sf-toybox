/**
 * クリップボードと保存の差し替え（unit-test-instructions.md「模擬と差し替えの決まり」）。
 * navigator.clipboard.writeText と URL.createObjectURL を差し替え、呼ばれた回数と中身を記録する。
 */
import { vi, type MockInstance } from 'vitest';

export type OutputSpies = {
  writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;
  createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
  revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;
  click: MockInstance<() => void>;
  /** 保存しようとしたファイル名 */
  downloads: string[];
  /** 保存しようとした Blob */
  blobs: Blob[];
};

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

export function installOutputSpies(): OutputSpies {
  const downloads: string[] = [];
  const blobs: Blob[] = [];
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
  const createObjectURL = vi.fn<(blob: Blob) => string>((blob) => {
    blobs.push(blob);
    return 'blob:sftoybox-test';
  });
  const revokeObjectURL = vi.fn<(url: string) => void>(() => undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  return { writeText, createObjectURL, revokeObjectURL, click, downloads, blobs };
}

/**
 * user-event の setup() は navigator.clipboard を自前のものに置き換えるため、
 * setup() のあとで記録用の writeText を付け直す。
 */
export function reattachClipboard(spies: OutputSpies): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: spies.writeText },
  });
}

export function restoreOutputSpies(): void {
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
}
