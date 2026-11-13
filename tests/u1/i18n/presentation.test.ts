import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messageFor, t } from '../../../src/i18n/presentation';
import type { MessageKey } from '../../../src/i18n/message-keys';
import { APP_ERROR_KINDS } from '../../../src/shared/result';
import { readLocaleMessages, setUiLanguage } from '../helpers/chrome-mock';

describe('表示の文言（presentation、C2）', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('ブラウザの言語が日本語なら日本語の文言（BR4.1、AC1.1.8）', () => {
    setUiLanguage('ja');

    expect(t('options.title')).toBe('sf-toybox 設定');
    expect(t('pageSize.invalid')).toBe('1 以上の整数を入力してください');
  });

  it.each(['en-US', 'fr'])('それ以外の言語（%s）なら英語の文言（BR4.1）', (language) => {
    setUiLanguage(language);

    expect(t('options.title')).toBe('sf-toybox settings');
    expect(t('pageSize.apply')).toBe('Show');
  });

  it('パラメータを差し込み、知らない名前の差し込み先はそのまま残す', () => {
    setUiLanguage('ja');

    expect(t('options.recentErrorsNote', { max: 20 })).toContain('最大 20 件');
    expect(t('options.recentErrorsNote', { other: 1 })).toContain('{max}');
  });

  it('messageFor は全 kind と unexpected を文言にする', () => {
    setUiLanguage('en');

    for (const kind of [...APP_ERROR_KINDS, 'unexpected'] as const) {
      const text = messageFor({ kind });
      expect(text, kind).toBe(readLocaleMessages('en')[`error_${kind}`]?.message);
    }
    expect(messageFor({ kind: 'storageFailed' })).toBe('Could not save');
  });

  it('知らないキーのときは、キーを返したうえでエラーを記録する', () => {
    const unknownKey = 'options.doesNotExist' as MessageKey;

    expect(t(unknownKey)).toBe(unknownKey);
    expect(console.error).toHaveBeenCalledWith(
      '[sf-toybox:core]',
      'unexpected',
      'errorLog.unknownMessageKey',
    );
  });
});
