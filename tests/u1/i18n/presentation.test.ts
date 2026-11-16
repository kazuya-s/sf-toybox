import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messageFor, t } from '../../../src/i18n/presentation';
import type { MessageKey } from '../../../src/i18n/message-keys';
import { APP_ERROR_KINDS } from '../../../src/shared/result';
import { readLocaleMessages, setUiLanguage } from '../helpers/chrome-mock';

describe('UI messages (presentation, C2)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('uses Japanese messages when the browser language is Japanese (BR4.1, AC1.1.8)', () => {
    setUiLanguage('ja');

    expect(t('options.title')).toBe('sf-toybox 設定');
    expect(t('pageSize.invalid')).toBe('1 以上の整数を入力してください');
  });

  it.each(['en-US', 'fr'])('uses English messages for other languages (%s) (BR4.1)', (language) => {
    setUiLanguage(language);

    expect(t('options.title')).toBe('sf-toybox settings');
    expect(t('pageSize.apply')).toBe('Show');
  });

  it('fills in parameters and leaves unknown placeholders as is', () => {
    setUiLanguage('ja');

    expect(t('options.recentErrorsNote', { max: 20 })).toContain('最大 20 件');
    expect(t('options.recentErrorsNote', { other: 1 })).toContain('{max}');
  });

  it('messageFor turns every kind and unexpected into a message', () => {
    setUiLanguage('en');

    for (const kind of [...APP_ERROR_KINDS, 'unexpected'] as const) {
      const text = messageFor({ kind });
      expect(text, kind).toBe(readLocaleMessages('en')[`error_${kind}`]?.message);
    }
    expect(messageFor({ kind: 'storageFailed' })).toBe('Could not save');
  });

  it('returns the key itself for an unknown key and logs an error', () => {
    const unknownKey = 'options.doesNotExist' as MessageKey;

    expect(t(unknownKey)).toBe(unknownKey);
    expect(console.error).toHaveBeenCalledWith(
      '[sf-toybox:core]',
      'unexpected',
      'errorLog.unknownMessageKey',
    );
  });
});
