import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detect } from '../../../src/page/page-context';
import {
  ORG_HOST,
  html,
  restoreFrame,
  setBodyHtml,
  setEmbeddedFrame,
  urls,
} from '../fixtures/pages';

describe('Page detection (page-context, C3 detect)', () => {
  beforeEach(() => {
    setEmbeddedFrame(true);
    setBodyHtml(html.plain);
  });

  afterEach(() => {
    restoreFrame();
  });

  it('a page with rowsperpage in the URL is pageSizeList (BR2.1)', () => {
    const result = detect({ url: urls.listWithRowsPerPage, document });

    expect(result).toEqual({
      url: urls.listWithRowsPerPage,
      pageKind: 'pageSizeList',
      changeSetId: null,
      orgHost: ORG_HOST,
    });
  });

  it.each([html.listWithPagination, html.listWithRowsPerPageLink, html.paginationWithoutTable])(
    'a list with a pager or a page-size link is pageSizeList (BR2.3)',
    (body) => {
      setBodyHtml(body);

      expect(detect({ url: urls.listWithoutRowsPerPage, document }).pageKind).toBe('pageSizeList');
    },
  );

  it('a page with no markers is other', () => {
    expect(detect({ url: urls.plain, document }).pageKind).toBe('other');
  });

  it('a top-level classic-style page (Classic) is other (BR2.2)', () => {
    setEmbeddedFrame(false);
    setBodyHtml(html.listWithPagination);

    expect(detect({ url: urls.listWithRowsPerPage, document }).pageKind).toBe('other');
  });

  it('a /lightning/ page is other even when embedded', () => {
    setBodyHtml(html.listWithPagination);

    expect(detect({ url: urls.lightning, document }).pageKind).toBe('other');
  });

  it.each([urls.changeSetDetail15, urls.changeSetDetail18])(
    'detects the change set detail page and extracts the ID (BR2.4): %s',
    (url) => {
      const result = detect({ url, document });

      expect(result.pageKind).toBe('outboundChangeSetDetail');
      expect(result.changeSetId).toBe(new URL(url).searchParams.get('id'));
    },
  );

  it('detects the change set Add page and extracts the ID (BR2.4)', () => {
    const result = detect({ url: urls.changeSetAdd, document });

    expect(result.pageKind).toBe('outboundChangeSetAdd');
    expect(result.changeSetId).toBe('0A2xx0000000001AAA');
  });

  it('a malformed or missing ID is other, and orgHost is the frame host name (BR2.4, BR2.5)', () => {
    const badId = detect({ url: urls.changeSetBadId, document });
    const noId = detect({ url: urls.changeSetNoId, document });
    const otherHost = detect({
      url: 'https://example--sandbox.sandbox.my.salesforce-setup.com/01p?rowsperpage=100',
      document,
    });

    expect(badId).toMatchObject({ pageKind: 'other', changeSetId: null, orgHost: ORG_HOST });
    expect(noId.pageKind).toBe('other');
    expect(otherHost.orgHost).toBe('example--sandbox.sandbox.my.salesforce-setup.com');
  });
});
