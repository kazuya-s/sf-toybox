import { beforeEach, describe, expect, it } from 'vitest';
import { addComponent } from '../../../src/changeset/add-component';
import { ERROR_MESSAGES } from '../../../src/salesforce/markers';
import type { Result } from '../../../src/shared/result';
import { html, installFetchMock, networkError, redirect } from '../helpers/fetch-mock';
import { TEST_CHANGE_SET_ID, readFixture, useSalesforceLocation } from '../helpers/location';
import { ADD_FORM_ACTION, ADD_PAGE_1, ADD_PAGE_2, DETAIL_PAGE_1 } from '../helpers/paths';

const changeSetId = TEST_CHANGE_SET_ID;
/** Checkbox value for Field_C__c in add-page2.html */
const FIELD_C_KEY = '00N000000000003';
const request = { changeSetId, componentType: 'CustomField', componentKey: FIELD_C_KEY };

function routeAddPages() {
  return installFetchMock()
    .route(ADD_PAGE_1, html(readFixture('add-page1.html')))
    .route(ADD_PAGE_2, html(readFixture('add-page2.html')));
}

function errorOf<T>(result: Result<T>) {
  if (result.ok) throw new Error('Expected a failure');
  return result.error;
}

describe('Adding one component (addComponent, BR3.2-BR3.5)', () => {
  beforeEach(() => {
    useSalesforceLocation();
  });

  it('POST body: only the hidden fields, the "Add" button and the one selected checkbox (NFR3.2)', async () => {
    const mock = routeAddPages()
      .route(ADD_FORM_ACTION, redirect(), 'POST')
      .route(DETAIL_PAGE_1, html(readFixture('detail-after-add.html')));

    await addComponent(request);

    const post = mock.calls.find((call) => call.method === 'POST');
    expect(post?.path).toBe(ADD_FORM_ACTION);
    expect([...new URLSearchParams(post?.body ?? '')]).toEqual([
      ['id', 'test-changeset'],
      ['_CONFIRMATIONTOKEN', 'test-token-2'],
      ['viewState', 'test-viewstate-2'],
      ['save', '変更セットに追加'],
      ['ids', FIELD_C_KEY],
    ]);
  });

  it('finds the row on page 2, sends it, and succeeds when the reload finds it', async () => {
    const mock = routeAddPages()
      .route(ADD_FORM_ACTION, html(readFixture('add-page1.html')), 'POST')
      .route(DETAIL_PAGE_1, html(readFixture('detail-after-add.html')));

    const result = await addComponent(request);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mock.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `GET ${ADD_PAGE_1}`,
      `GET ${ADD_PAGE_2}`,
      `POST ${ADD_FORM_ACTION}`,
      `GET ${DETAIL_PAGE_1}`,
    ]);
  });

  it('returns notFound without sending when no page has the row (BR3.5)', async () => {
    const mock = routeAddPages();

    const missing = await addComponent({ ...request, componentKey: '00N000000000009' });
    const invalid = await addComponent({ ...request, componentKey: '' });

    expect(errorOf(missing)).toEqual({
      kind: 'notFound',
      message: ERROR_MESSAGES.candidateNotFound,
      detail: null,
    });
    expect(errorOf(invalid).message).toBe(ERROR_MESSAGES.invalidRequest);
    expect(mock.calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it('returns that page failure, not notFound, when a page in between cannot be read', async () => {
    const mock = installFetchMock()
      .route(ADD_PAGE_1, html(readFixture('add-page1.html')))
      .route(ADD_PAGE_2, redirect());

    const result = await addComponent(request);

    expect(errorOf(result).kind).toBe('sessionExpired');
    expect(mock.calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it('double send: two back-to-back requests for the same (changeSetId, componentKey) make one POST (NFR3.3)', async () => {
    const mock = routeAddPages()
      .route(ADD_FORM_ACTION, redirect(), 'POST')
      .route(DETAIL_PAGE_1, html(readFixture('detail-after-add.html')));

    const [first, second] = await Promise.all([addComponent(request), addComponent(request)]);
    expect(mock.count(ADD_FORM_ACTION, 'POST')).toBe(1);
    expect(first).toEqual({ ok: true, value: undefined });
    expect(second).toBe(first);

    // Once finished it is removed from the table, so the next request sends again
    await addComponent(request);
    expect(mock.count(ADD_FORM_ACTION, 'POST')).toBe(2);
  });

  it('a failed POST is neither resent nor followed by a reload', async () => {
    const mock = routeAddPages().route(ADD_FORM_ACTION, networkError(), 'POST');

    const result = await addComponent(request);

    expect(errorOf(result).kind).toBe('network');
    expect(mock.count(ADD_FORM_ACTION, 'POST')).toBe(1);
    expect(mock.count(DETAIL_PAGE_1)).toBe(0);
  });

  it('returns unexpectedResponse (could not verify) when the reload does not find it (BR3.3)', async () => {
    routeAddPages()
      .route(ADD_FORM_ACTION, redirect(), 'POST')
      .route(DETAIL_PAGE_1, html(readFixture('detail-single.html')));

    const result = await addComponent(request);

    expect(errorOf(result)).toEqual({
      kind: 'unexpectedResponse',
      message: ERROR_MESSAGES.addNotConfirmed,
      detail: null,
    });
  });

  it('redirects and session expiry: a POST redirect proceeds to the reload; a redirect on that GET is session expiry (BR1.4)', async () => {
    const mock = routeAddPages()
      .route(ADD_FORM_ACTION, redirect(), 'POST')
      .route(DETAIL_PAGE_1, redirect());

    const result = await addComponent(request);

    expect(errorOf(result).kind).toBe('sessionExpired');
    expect(mock.count(DETAIL_PAGE_1)).toBe(1);
    expect(mock.count(ADD_FORM_ACTION, 'POST')).toBe(1);
  });
});
