import { describe, expect, it } from 'vitest';
import { TEST_EXTENSION_ID } from './helpers/chrome-mock';

describe('Test tooling setup', () => {
  it('the happy-dom document and the chrome mock are available', () => {
    document.body.append(document.createElement('main'));

    expect(document.querySelector('main')).not.toBeNull();
    expect(chrome.runtime.id).toBe(TEST_EXTENSION_ID);
  });
});
