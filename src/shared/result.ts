/**
 * Result type shared by all contracts (contract-summary.md "Shared result type").
 * Failures are returned as values of this type, never thrown.
 */

/** AppError kinds. U1 added storageFailed (functional-spec.md "Additions to the contracts") */
export const APP_ERROR_KINDS = [
  'sessionExpired',
  'permissionDenied',
  'timeout',
  'network',
  'unexpectedResponse',
  'notFound',
  'changeSetLocked',
  'storageFailed',
] as const;

export type AppErrorKind = (typeof APP_ERROR_KINDS)[number];

export type AppError = {
  kind: AppErrorKind;
  /** Developer-facing description. User-facing text is built from kind by Presentation */
  message: string;
  /** Optional. A summary of the error Salesforce returned, etc. */
  detail: string | null;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(
  kind: AppErrorKind,
  message: string,
  detail: string | null = null,
): Result<T> {
  return { ok: false, error: { kind, message, detail } };
}
