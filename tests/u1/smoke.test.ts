import { describe, expect, it } from 'vitest';
import { TEST_EXTENSION_ID } from './helpers/chrome-mock';

describe('テストの道具の用意', () => {
  it('happy-dom の文書と chrome の模擬が使える', () => {
    document.body.append(document.createElement('main'));

    expect(document.querySelector('main')).not.toBeNull();
    expect(chrome.runtime.id).toBe(TEST_EXTENSION_ID);
  });
});
