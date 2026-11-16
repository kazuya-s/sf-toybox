import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAllPages, type PageRead } from '../../../src/changeset/paging';
import { CHANGE_SET_MARKERS, MAX_PAGES } from '../../../src/salesforce/markers';
import type { LoadProgress, ParsedPage } from '../../../src/salesforce/types';
import { fail, ok, type Result } from '../../../src/shared/result';
import { html, installFetchMock, redirect } from '../helpers/fetch-mock';
import { readFixture, useSalesforceLocation } from '../helpers/location';
import { DETAIL_PAGE_1, DETAIL_PAGE_2, DETAIL_PAGE_3 } from '../helpers/paths';

/** Reads one page: returns column 2 (name) of each row; fails if there is no table */
function readNames(page: ParsedPage): Result<PageRead<string[]>> {
  const table = page.table(CHANGE_SET_MARKERS.detail.componentTable);
  if (!table) return fail('unexpectedResponse', 'changeset.missingTable');
  const names = table.rows.map((row) => row.cells[1] ?? '');
  return ok({ data: names, rowCount: names.length });
}

function routeThreePages() {
  return installFetchMock()
    .route(DETAIL_PAGE_1, html(readFixture('detail-page1.html')))
    .route(DETAIL_PAGE_2, html(readFixture('detail-page2.html')))
    .route(DETAIL_PAGE_3, html(readFixture('detail-page3.html')));
}

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`Expected success: ${result.error.kind}`);
  return result.value;
}

describe('Reading pages in order (paging, BR2.2, BR2.3)', () => {
  beforeEach(() => {
    useSalesforceLocation();
  });

  it('a single page is complete: true with progress 1/1', async () => {
    installFetchMock().route(DETAIL_PAGE_1, html(readFixture('detail-single.html')));
    const progress: LoadProgress[] = [];

    const result = valueOf(
      await readAllPages({
        firstPath: DETAIL_PAGE_1,
        parsePage: readNames,
        onProgress: (value) => progress.push(value),
      }),
    );

    expect(result.complete).toBe(true);
    expect(result.failedPages).toBe(0);
    expect(result.pages.map((page) => page.data)).toEqual([
      ['TestClass', 'Field_A__c', 'TestPage'],
    ]);
    expect(progress).toEqual([{ loadedPages: 1, totalPages: 1 }]);
  });

  it('reads three pages in order and reports progress 1/3, 2/3, 3/3', async () => {
    routeThreePages();
    const progress: LoadProgress[] = [];

    const result = valueOf(
      await readAllPages({
        firstPath: DETAIL_PAGE_1,
        parsePage: readNames,
        onProgress: (value) => progress.push(value),
      }),
    );

    expect(result.complete).toBe(true);
    expect(result.pages).toHaveLength(3);
    expect(progress).toEqual([
      { loadedPages: 1, totalPages: 3 },
      { loadedPages: 2, totalPages: 3 },
      { loadedPages: 3, totalPages: 3 },
    ]);
  });

  it('sequential reads: no two fetches run at once across pages (NFR7.2)', async () => {
    const mock = routeThreePages();

    await readAllPages({ firstPath: DETAIL_PAGE_1, parsePage: readNames });

    expect(mock.maxConcurrent).toBe(1);
    expect(mock.calls.map((call) => call.path)).toEqual([
      DETAIL_PAGE_1,
      DETAIL_PAGE_2,
      DETAIL_PAGE_3,
    ]);
  });

  it('a page 1 failure is ok: false with that kind', async () => {
    installFetchMock().route(DETAIL_PAGE_1, redirect());

    const result = await readAllPages({ firstPath: DETAIL_PAGE_1, parsePage: readNames });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'sessionExpired' }),
    });
  });

  it('a page 2 failure (session expiry, unexpected shape) returns what was read with complete: false and reads no further', async () => {
    const mock = installFetchMock()
      .route(DETAIL_PAGE_1, html(readFixture('detail-page1.html')))
      .route(DETAIL_PAGE_2, [redirect(), html('<p>no table</p>')]);

    const expired = valueOf(await readAllPages({ firstPath: DETAIL_PAGE_1, parsePage: readNames }));
    const broken = valueOf(await readAllPages({ firstPath: DETAIL_PAGE_1, parsePage: readNames }));

    expect(expired).toMatchObject({
      complete: false,
      failedPages: 2,
      pageError: { kind: 'sessionExpired' },
    });
    expect(expired.pages).toHaveLength(1);
    expect(broken).toMatchObject({
      complete: false,
      failedPages: 2,
      pageError: { kind: 'unexpectedResponse' },
    });
    expect(mock.count(DETAIL_PAGE_3)).toBe(0);
  });

  it('200-page cap: stops at 200 pages even with "Next Page" still present, complete: false (NFR7.3)', async () => {
    const mock = installFetchMock().fallback((call) => {
      const match = /^\/endless\?p=(\d+)$/.exec(call.path);
      if (!match) return null;
      const next = Number(match[1]) + 1;
      return html(
        `<div class="componentList"><table class="list"><tr class="dataRow"><td>x</td><td>R${match[1]}</td></tr></table></div>` +
          `<div class="paginator"><a class="next" href="/endless?p=${next}">next</a></div>`,
      );
    });

    const result = valueOf(await readAllPages({ firstPath: '/endless?p=1', parsePage: readNames }));

    expect(mock.calls).toHaveLength(MAX_PAGES);
    expect(result.pages).toHaveLength(MAX_PAGES);
    expect(result.complete).toBe(false);
    // The total is unknown, so 1
    expect(result.failedPages).toBe(1);
  });

  it('loading continues when onProgress throws, and stopWhen can end it early', async () => {
    const mock = routeThreePages();
    const onProgress = vi.fn(() => {
      throw new Error('progress failed');
    });

    const all = valueOf(
      await readAllPages({ firstPath: DETAIL_PAGE_1, parsePage: readNames, onProgress }),
    );
    const stopped = valueOf(
      await readAllPages({
        firstPath: DETAIL_PAGE_1,
        parsePage: readNames,
        stopWhen: (names) => names.includes('TestPageB'),
      }),
    );

    expect(all.complete).toBe(true);
    expect(all.pages).toHaveLength(3);
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(stopped.complete).toBe(true);
    expect(stopped.pages).toHaveLength(2);
    expect(mock.count(DETAIL_PAGE_3)).toBe(1);
  });
});
