/**
 * Salesforce とのやり取り（SalesforceConnection、ADR-002）。U2 で fetch を使うのはこのファイルだけ。
 *
 * - 送り先は、フレームと同じオリジンの https だけ（BR1.1、security-design.md §1）
 * - ログイン中のセッションをそのまま使い、転送はたどらない（BR1.2、§2）
 * - 30 秒で打ち切り、自動では再試行しない（BR1.3、§6）
 * - 応答から失敗の種類を見分け、Result で返す（BR1.4、BR1.7）
 */
import { fail, ok, type Result } from '../shared/result';
import {
  ERROR_MESSAGES,
  REQUEST_TIMEOUT_MS,
  isLoginPage,
  isNotFoundPage,
  isPermissionDeniedPage,
} from './markers';
import { parsePage } from './parse';
import type { SalesforcePage, SalesforceRequest, SalesforceResponse } from './types';

/** 呼び出し元から渡されたパスの形: / で始まり、// や /\ で始まらない */
function isOrgPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

/**
 * 送り先を解き、同じオリジンの https のときだけ URL を返す（security-design.md §1）。
 * base がないときはパスの形も確かめる。base があるとき（フォームの送り先、ページ送りのリンク）は、
 * その画面の URL を基準に解いて、オリジンだけを確かめる。
 */
export function resolveDestination(path: string, base?: string): URL | null {
  if (base === undefined && !isOrgPath(path)) return null;
  let url: URL;
  try {
    url = new URL(path, base ?? location.origin);
  } catch {
    return null;
  }
  return url.origin === location.origin && url.protocol === 'https:' ? url : null;
}

function isRedirect(response: Response): boolean {
  return response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400);
}

function bodyOf(request: SalesforceRequest): URLSearchParams | undefined {
  if (request.method !== 'POST') return undefined;
  return new URLSearchParams((request.formFields ?? []).map((field) => [field.name, field.value]));
}

type Fetched = { kind: 'redirect' } | { kind: 'page'; status: number; text: string };

/** fetch から本文の読み取りまでを 30 秒で打ち切る。時計は finally で止める */
async function fetchWithTimeout(url: URL, request: SalesforceRequest): Promise<Result<Fetched>> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.href, {
      method: request.method,
      credentials: 'same-origin',
      redirect: 'manual',
      signal: controller.signal,
      body: bodyOf(request),
    });
    if (isRedirect(response)) return ok({ kind: 'redirect' });
    const text = await response.text();
    return ok({ kind: 'page', status: response.status, text });
  } catch (error) {
    if (timedOut) return fail('timeout', ERROR_MESSAGES.timeout);
    if (error instanceof TypeError) return fail('network', ERROR_MESSAGES.network);
    return fail('unexpectedResponse', ERROR_MESSAGES.unexpectedError);
  } finally {
    clearTimeout(timer);
  }
}

/** 受け取った画面から失敗の種類を見分ける（BR1.4） */
function classifyPage(status: number, url: string, text: string): Result<SalesforcePage> {
  const page = parsePage(text);
  if (isLoginPage(page)) return fail('sessionExpired', ERROR_MESSAGES.loginPage);
  if (status === 403 || isPermissionDeniedPage(page)) {
    return fail('permissionDenied', ERROR_MESSAGES.permissionDenied);
  }
  if (status === 404 || isNotFoundPage(page)) return fail('notFound', ERROR_MESSAGES.notFoundPage);
  if (status !== 200) return fail('unexpectedResponse', ERROR_MESSAGES.unexpectedStatus);
  return ok({ redirected: false, status, url, page });
}

/**
 * 1 回のやり取り。例外は外に出さず、失敗は Result で返す。失敗しても送り直さない。
 * GET への転送は sessionExpired、POST への転送は { redirected: true } の成功（BR1.4）。
 */
export async function request(call: SalesforceRequest): Promise<Result<SalesforceResponse>> {
  try {
    const url = resolveDestination(call.path, call.base);
    if (!url) return fail('unexpectedResponse', ERROR_MESSAGES.invalidDestination);

    const fetched = await fetchWithTimeout(url, call);
    if (!fetched.ok) return fetched;
    if (fetched.value.kind === 'redirect') {
      return call.method === 'POST'
        ? ok({ redirected: true })
        : fail('sessionExpired', ERROR_MESSAGES.redirected);
    }
    return classifyPage(fetched.value.status, url.href, fetched.value.text);
  } catch {
    return fail('unexpectedResponse', ERROR_MESSAGES.unexpectedError);
  }
}

/** 画面を GET で読む。読み取れた画面だけを成功として返す */
export async function getPage(path: string, base?: string): Promise<Result<SalesforcePage>> {
  const result = await request({ path, base, method: 'GET' });
  if (!result.ok) return result;
  if (result.value.redirected) return fail('sessionExpired', ERROR_MESSAGES.redirected);
  return ok(result.value);
}
