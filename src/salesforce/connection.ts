/**
 * Communication with Salesforce (SalesforceConnection, ADR-002). The only U2 file that uses fetch.
 *
 * - Sends only to https on the same origin as the frame (BR1.1, security-design.md §1)
 * - Uses the logged-in session as is and never follows redirects (BR1.2, §2)
 * - Times out after 30 seconds and never retries automatically (BR1.3, §6)
 * - Classifies failures from the response and returns them as Result (BR1.4, BR1.7)
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

/** Shape of a caller-supplied path: starts with / and not with // or /\ */
function isOrgPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

/**
 * Resolves the destination and returns a URL only for https on the same origin (security-design.md §1).
 * Without base it also checks the path shape. With base (a form action or a pager link),
 * it resolves against that page's URL and checks only the origin.
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

/** Times out after 30 seconds, from fetch through reading the body. The timer is cleared in finally */
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

/** Classifies the failure from the received page (BR1.4) */
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
 * One request. Never throws; failures are returned as Result. Never resends on failure.
 * A redirect on GET is sessionExpired; a redirect on POST is a success { redirected: true } (BR1.4).
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

/** Reads a page with GET. Only a readable page is returned as success */
export async function getPage(path: string, base?: string): Promise<Result<SalesforcePage>> {
  const result = await request({ path, base, method: 'GET' });
  if (!result.ok) return result;
  if (result.value.redirected) return fail('sessionExpired', ERROR_MESSAGES.redirected);
  return ok(result.value);
}
