/**
 * UI messages (t and messageFor of C2 in contract-summary.md).
 * Japanese when the browser language is Japanese, English otherwise (BR4.1). chrome.i18n picks the language.
 */
import { recordError, type ErrorLogKind } from '../errors/error-log';
import type { AppError } from '../shared/result';
import { toLocaleKey, type MessageKey } from './message-keys';

export type MessageParams = Record<string, string | number>;

/** Replaces `{name}` in a message with the value from params */
function fillParams(message: string, params: MessageParams): string {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/**
 * Returns the display string for a message key.
 * For an unknown key, returns the key itself and logs an error for developers.
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

/** Builds the user-facing message for a failure kind */
export function messageFor(error: Pick<AppError, 'kind'> | { kind: ErrorLogKind }): string {
  // Every error.<kind> message is in MESSAGE_KEYS (checked in tests/u1/i18n/presentation.test.ts)
  return t(`error.${error.kind}` as MessageKey);
}
