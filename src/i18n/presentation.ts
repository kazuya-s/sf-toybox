/**
 * 表示の文言（contract-summary.md C2 の t・messageFor）。
 * ブラウザの言語が日本語なら日本語、それ以外は英語（BR4.1）。言語の選び方は chrome.i18n に任せる。
 */
import { recordError, type ErrorLogKind } from '../errors/error-log';
import type { AppError } from '../shared/result';
import { toLocaleKey, type MessageKey } from './message-keys';

export type MessageParams = Record<string, string | number>;

/** 文言の中の `{name}` を params の値に置き換える */
function fillParams(message: string, params: MessageParams): string {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/**
 * 文言キーから表示する文字列を返す。
 * 知らないキーのときはキーそのものを返し、開発者向けにエラーを記録する。
 */
export function t(key: MessageKey, params: MessageParams | null = null): string {
  let message = '';
  try {
    message = chrome.i18n.getMessage(toLocaleKey(key));
  } catch {
    message = '';
  }
  if (!message) {
    void recordError({
      toolId: 'core',
      kind: 'unexpected',
      messageKey: 'errorLog.unknownMessageKey',
    });
    return key;
  }
  return params ? fillParams(message, params) : message;
}

/** 失敗の種類から利用者向けの文言を作る */
export function messageFor(error: Pick<AppError, 'kind'> | { kind: ErrorLogKind }): string {
  // error.<kind> の文言はすべて MESSAGE_KEYS にある（tests/u1/i18n/presentation.test.ts で確かめる）
  return t(`error.${error.kind}` as MessageKey);
}
