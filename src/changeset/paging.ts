/**
 * ページを順に読む共通の処理（functional-design/rules.md の BR2.2、BR2.3、security-design.md §7）。
 *
 * 1 ページずつ for ループの中で await して読み（同時には読まない）、「次のページ」のリンクを
 * その画面の URL を基準に SalesforceConnection でたどる（送り先の確かめは connection.ts が行う）。
 * 200 ページで打ち切る。
 */
import { getPage } from '../salesforce/connection';
import { CHANGE_SET_MARKERS, MAX_PAGES } from '../salesforce/markers';
import type { LoadProgress, ParsedPage } from '../salesforce/types';
import { ok, type AppError, type Result } from '../shared/result';

/** 1 ページを読み取った結果 */
export type PageRead<D> = { data: D; rowCount: number };

export type LoadedPage<D> = { data: D; url: string };

export type PagedResult<D> = {
  pages: LoadedPage<D>[];
  /** false のとき、2 ページ目以降の失敗か、200 ページでの打ち切りで、読めていないページがある */
  complete: boolean;
  failedPages: number;
  /** 2 ページ目以降で失敗したときの、その失敗 */
  pageError: AppError | null;
};

export type ReadAllPagesOptions<D> = {
  firstPath: string;
  /** 1 ページ分を読み取る。想定と違う形なら失敗を返す（BR2.7） */
  parsePage: (page: ParsedPage) => Result<PageRead<D>>;
  onProgress?: (progress: LoadProgress) => void;
  /** true を返したら、そのページで読むのをやめる（追加の候補を探すときに使う） */
  stopWhen?: (data: D) => boolean;
};

type NextPage = { path: string; base?: string };

/** 全体の件数の表示から数を読む（例: "1,234" → 1234） */
function parseCount(text: string | null): number | null {
  const digits = text?.match(/\d[\d,]*/)?.[0];
  if (!digits) return null;
  const count = Number(digits.replace(/,/g, ''));
  return Number.isSafeInteger(count) ? count : null;
}

/** 1 ページ目からページ数を見積もる。分からなければ null */
function estimateTotalPages(page: ParsedPage, hasNext: boolean, rowCount: number): number | null {
  if (!hasNext) return 1;
  const totalCount = parseCount(page.text(CHANGE_SET_MARKERS.paging.totalCount));
  if (totalCount === null || rowCount === 0) return null;
  return Math.max(2, Math.ceil(totalCount / rowCount));
}

/** 失敗したページと、それより後で読めなかったページの数（BR2.3） */
function remainingPages(totalPages: number | null, loadedPages: number): number {
  return totalPages !== null && totalPages > loadedPages ? totalPages - loadedPages : 1;
}

/**
 * 進み具合を知らせる。知らせる側（U3 の受け取りの処理）の例外で読み込みを止めないよう、
 * ここで起きた例外は意図して無視する（code-generation-plan.md「進み具合の知らせ方」）。
 */
function notifyProgress(
  onProgress: ((progress: LoadProgress) => void) | undefined,
  progress: LoadProgress,
): void {
  try {
    onProgress?.(progress);
  } catch {
    // 知らせる側の失敗は、読み込みの結果に影響させない
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

/** すべてのページを順に読む。1 ページ目の失敗だけを ok: false で返す */
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

  // ループを抜けてもまだ「次のページ」があるのは、200 ページで打ち切ったとき（BR2.2）
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
