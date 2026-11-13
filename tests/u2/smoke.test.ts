import { describe, expect, it } from 'vitest';
import { html, installFetchMock } from './helpers/fetch-mock';
import { TEST_ORIGIN, useSalesforceLocation } from './helpers/location';

describe('U2 のテストの道具', () => {
  it('location を架空の組織にし、差し替えた fetch が決めた応答を返す', async () => {
    useSalesforceLocation();
    const mock = installFetchMock().route('/smoke', html('<p>ok</p>'));

    const response = await fetch(`${location.origin}/smoke`);

    expect(location.origin).toBe(TEST_ORIGIN);
    expect(await response.text()).toBe('<p>ok</p>');
    expect(mock.calls).toHaveLength(1);
    expect(mock.maxConcurrent).toBe(1);
  });
});
