/**
 * Clipboard and download stubs (unit-test-instructions.md "Mock and stub rules").
 * Replaces navigator.clipboard.writeText and URL.createObjectURL and records call counts and contents.
 */
import { vi, type MockInstance } from 'vitest';

export type OutputSpies = {
  writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;
  createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
  revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;
  click: MockInstance<() => void>;
  /** File name that was to be saved */
  downloads: string[];
  /** Blob that was to be saved */
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
 * user-event's setup() replaces navigator.clipboard with its own,
 * so the recording writeText is reattached after setup().
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
