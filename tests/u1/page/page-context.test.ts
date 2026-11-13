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

describe('画面の判定（page-context、C3 の detect）', () => {
  beforeEach(() => {
    setEmbeddedFrame(true);
    setBodyHtml(html.plain);
  });

  afterEach(() => {
    restoreFrame();
  });

  it('URL に rowsperpage がある画面は pageSizeList（BR2.1）', () => {
    const result = detect({ url: urls.listWithRowsPerPage, document });

    expect(result).toEqual({
      url: urls.listWithRowsPerPage,
      pageKind: 'pageSizeList',
      changeSetId: null,
      orgHost: ORG_HOST,
    });
  });

  it.each([html.listWithPagination, html.listWithRowsPerPageLink, html.paginationWithoutTable])(
    'ページ送りか件数のリンクがある一覧は pageSizeList（BR2.3）',
    (body) => {
      setBodyHtml(body);

      expect(detect({ url: urls.listWithoutRowsPerPage, document }).pageKind).toBe('pageSizeList');
    },
  );

  it('しるしがない画面は other', () => {
    expect(detect({ url: urls.plain, document }).pageKind).toBe('other');
  });

  it('最上位の古い形式の画面（Classic）は other（BR2.2）', () => {
    setEmbeddedFrame(false);
    setBodyHtml(html.listWithPagination);

    expect(detect({ url: urls.listWithRowsPerPage, document }).pageKind).toBe('other');
  });

  it('/lightning/ の画面は、埋め込まれていても other', () => {
    setBodyHtml(html.listWithPagination);

    expect(detect({ url: urls.lightning, document }).pageKind).toBe('other');
  });

  it.each([urls.changeSetDetail15, urls.changeSetDetail18])(
    '変更セットの詳細画面を判定し、ID を取り出す（BR2.4）: %s',
    (url) => {
      const result = detect({ url, document });

      expect(result.pageKind).toBe('outboundChangeSetDetail');
      expect(result.changeSetId).toBe(new URL(url).searchParams.get('id'));
    },
  );

  it('変更セットの追加画面を判定し、ID を取り出す（BR2.4）', () => {
    const result = detect({ url: urls.changeSetAdd, document });

    expect(result.pageKind).toBe('outboundChangeSetAdd');
    expect(result.changeSetId).toBe('0A2xx0000000001AAA');
  });

  it('ID の形が正しくないかないときは other で、orgHost はフレームのホスト名（BR2.4、BR2.5）', () => {
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
