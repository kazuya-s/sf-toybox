import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageInfo } from '../../../src/page/page-context';
import {
  PAGE_SIZE_BAR_HOST_ATTRIBUTE,
  mountPageSizeBar,
  mountWithSlds,
  toShadowCss,
} from '../../../src/page-size/mount';
import { ORG_HOST, html, setBodyHtml, urls } from '../fixtures/pages';

const shouldFailRender = vi.hoisted(() => ({ value: false }));

vi.mock('../../../src/page-size/PageSizeBar', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/page-size/PageSizeBar')>();
  return {
    PageSizeBar: (props: Parameters<typeof original.PageSizeBar>[0]) => {
      if (shouldFailRender.value) throw new Error('render failed');
      return <original.PageSizeBar {...props} />;
    },
  };
});

const listPage: PageInfo = {
  url: urls.listWithRowsPerPage,
  pageKind: 'pageSizeList',
  changeSetId: null,
  orgHost: ORG_HOST,
};

async function mount(info: PageInfo = listPage): Promise<Element | null> {
  let host: Element | null = null;
  await act(async () => {
    host = mountPageSizeBar(info);
  });
  return host;
}

describe('件数バーの組み込み（mount）', () => {
  beforeEach(() => {
    shouldFailRender.value = false;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('Shadow DOM の中に SLDS と件数バーを出し、:root を :host に置き換える（BR4.2）', async () => {
    setBodyHtml(html.listWithPagination);

    const host = await mount();

    const shadow = host?.shadowRoot;
    expect(shadow).toBeTruthy();
    expect(shadow?.querySelector('style')).not.toBeNull();
    expect(shadow?.querySelector('[data-testid="page-size-bar"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="page-size-bar"]')).toBeNull();
    expect(toShadowCss(':root{--a:1}:root .x{}')).toBe(':host{--a:1}:host .x{}');
  });

  it('一覧の表のすぐ上に出す（mockups.md S2）', async () => {
    setBodyHtml(html.listWithPagination);

    const host = await mount();

    expect(host?.nextElementSibling).toBe(document.querySelector('table.list'));
  });

  it('表がないときは本文の先頭に出す', async () => {
    setBodyHtml(html.paginationWithoutTable);

    const host = await mount();

    expect(document.body.firstElementChild).toBe(host);
  });

  it('2 回呼んでも 1 つだけで、一覧の画面でなければ何もしない', async () => {
    setBodyHtml(html.listWithPagination);

    const first = await mount();
    const second = await mount();
    const changeSet = await mount({ ...listPage, pageKind: 'outboundChangeSetDetail' });

    expect(second).toBe(first);
    expect(changeSet).toBeNull();
    expect(document.querySelectorAll(`[${PAGE_SIZE_BAR_HOST_ATTRIBUTE}]`)).toHaveLength(1);
  });

  it('表示中のエラーでもページを壊さず、記録される（BR4.3）', async () => {
    setBodyHtml(html.listWithPagination);
    shouldFailRender.value = true;

    const host = await mount();

    expect(host?.shadowRoot?.querySelector('[data-testid="page-size-bar"]')).toBeNull();
    expect(document.querySelector('table.list')).not.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      '[sf-toybox:page-size-switcher]',
      'unexpected',
      'errorLog.pageSizeBarRenderFailed',
      expect.any(Error),
    );
  });

  it('mountWithSlds は同じ入れ物に何度呼んでも中身を作り直す', () => {
    const host = document.createElement('div');

    const first = mountWithSlds(host);
    const second = mountWithSlds(host);

    expect(first.root).not.toBe(second.root);
    expect(host.shadowRoot?.children).toHaveLength(2);
  });
});
