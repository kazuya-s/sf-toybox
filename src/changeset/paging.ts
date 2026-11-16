/**
 * Shared logic for reading pages in order (functional-design/rules.md BR2.2, BR2.3, security-design.md §7).
 *
 * Reads one page at a time with await inside a for loop (never concurrently) and follows the "Next Page" link
 * relative to that page's URL through SalesforceConnection (connection.ts checks the destination).
 * Stops at 200 pages.
 */
import { getPage } from '../salesforce/connection';
import { CHANGE_SET_MARKERS, MAX_PAGES } from '../salesforce/markers';
import type { LoadProgress, ParsedPage } from '../salesforce/types';
import { ok, type AppError, type Result } from '../shared/result';

/** Result of reading one page */
export type PageRead<D> = { data: D; rowCount: number };

export type LoadedPage<D> = { data: D; url: string };

export type PagedResult<D> = {
  pages: LoadedPage<D>[];
  /** When false, some pages were not read (a failure from page 2 on, or the 200-page cap) */
  complete: boolean;
  failedPages: number;
  /** The failure, when one happened from page 2 on */
  pageError: AppError | null;
};

export type ReadAllPagesOptions<D> = {
  firstPath: string;
  /** Reads one page. Returns a failure if the shape is unexpected (BR2.7) */
  parsePage: (page: ParsedPage) => Result<PageRead<D>>;
  onProgress?: (progress: LoadProgress) => void;
  /** Returning true stops reading at that page (used when searching for an add candidate) */
  stopWhen?: (data: D) => boolean;
};

type NextPage = { path: string; base?: string };

/** Reads the number from the total count text (e.g. "1,234" -> 1234) */
function parseCount(text: string | null): number | null {
  const digits = text?.match(/\d[\d,]*/)?.[0];
  if (!digits) return null;
  const count = Number(digits.replace(/,/g, ''));
  return Number.isSafeInteger(count) ? count : null;
}

/** Estimates the page count from page 1. null if unknown */
function estimateTotalPages(page: ParsedPage, hasNext: boolean, rowCount: number): number | null {
  if (!hasNext) return 1;
  const totalCount = parseCount(page.text(CHANGE_SET_MARKERS.paging.totalCount));
  if (totalCount === null || rowCount === 0) return null;
  return Math.max(2, Math.ceil(totalCount / rowCount));
}

/** Number of the failed page plus the pages after it that were not read (BR2.3) */
function remainingPages(totalPages: number | null, loadedPages: number): number {
  return totalPages !== null && totalPages > loadedPages ? totalPages - loadedPages : 1;
}

/**
 * Reports progress. Exceptions raised here are deliberately ignored so the reporter (U3's handler)
 * cannot stop the load (code-generation-plan.md, "How progress is reported").
 */
function notifyProgress(
  onProgress: ((progress: LoadProgress) => void) | undefined,
  progress: LoadProgress,
): void {
  try {
    onProgress?.(progress);
  } catch {
    // Reporter failures never affect the load result
  }
}

type LoadedRead<D> = { read: PageRead<D>; url: string; page: ParsedPage };
type PageOutcome<D> = Result<LoadedRead<D>>;

async function readOnePage<D>(
  next: NextPage,
  parse: ReadAllPagesOptions<D>['parsePage'],
): Promise<PageOutcome<D>> {
  const fetched = await getPage(next.path, next.base);
  if (!fetched.ok) return fetched;
  const read = parse(fetched.value.page);
  if (!read.ok) return read;
  return ok({ read: read.value, url: fetched.value.url, page: fetched.value.page });
}

/** Reads all pages in order. Only a failure on page 1 returns ok: false */
export async function readAllPages<D>(
  options: ReadAllPagesOptions<D>,
): Promise<Result<PagedResult<D>>> {
  const pages: LoadedPage<D>[] = [];
  let next: NextPage | null = { path: options.firstPath };
  let totalPages: number | null = null;

  for (let pageNumber = 1; pageNumber <= MAX_PAGES && next !== null; pageNumber += 1) {
    const outcome: PageOutcome<D> = await readOnePage(next, options.parsePage);
    if (!outcome.ok) {
      if (pageNumber === 1) return outcome;
      const failedPages = remainingPages(totalPages, pageNumber - 1);
      return ok({ pages, complete: false, failedPages, pageError: outcome.error });
    }

    const { read, url, page }: LoadedRead<D> = outcome.value;
    const nextHref: string | null = page.attribute(CHANGE_SET_MARKERS.paging.next, 'href');
    pages.push({ data: read.data, url });
    if (pageNumber === 1) totalPages = estimateTotalPages(page, nextHref !== null, read.rowCount);
    notifyProgress(options.onProgress, { loadedPages: pageNumber, totalPages });

    const shouldStop: boolean = options.stopWhen?.(read.data) === true;
    next = !shouldStop && nextHref !== null ? { path: nextHref, base: url } : null;
  }

  // A "Next Page" link still present after the loop means it stopped at 200 pages (BR2.2)
  if (next !== null) {
    return ok({
      pages,
      complete: false,
      failedPages: remainingPages(totalPages, MAX_PAGES),
      pageError: null,
    });
  }
  return ok({ pages, complete: true, failedPages: 0, pageError: null });
}
