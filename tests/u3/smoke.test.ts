import { describe, expect, it } from 'vitest';
import { ACTIVE_TAB_ID, popupState } from './helpers/chrome-popup';
import { buildManyComponents, loadComponents } from './helpers/fixtures';

describe('U3 のテストの道具', () => {
  it('chrome.tabs の模擬と架空の一覧が使える', async () => {
    const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) =>
      chrome.tabs.query({ active: true, currentWindow: true }, resolve),
    );

    expect(tabs.map((tab) => tab.id)).toEqual([ACTIVE_TAB_ID]);
    expect(popupState().queryInfos).toEqual([{ active: true, currentWindow: true }]);
    expect(loadComponents('components-basic').components).toHaveLength(3);
    expect(buildManyComponents().components).toHaveLength(2000);
  });
});
