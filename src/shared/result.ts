/**
 * 取り決め共通の結果の型（contract-summary.md「共通の結果の型」）。
 * 失敗は例外として投げず、この型の値で返す。
 */

/** AppError の種類。U1 で storageFailed を足した（functional-spec.md「取り決めへの追加」） */
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
  /** 開発者向けの説明。利用者向けの文言は Presentation が kind から作る */
  message: string;
  /** 任意。Salesforce が返したエラーの要旨など */
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
