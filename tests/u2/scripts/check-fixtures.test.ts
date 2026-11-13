import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFixtureText, checkFixtures } from '../../../scripts/check-fixtures.mjs';

/** 架空の値だけの例（cicd-pipeline.md「テストの HTML の例」） */
const VALID = `<!doctype html>
<a href="https://example.my.salesforce.com/0A2000000000001">TestChangeSet</a>
<input type="hidden" name="_CONFIRMATIONTOKEN" value="test-token">
<input type="checkbox" name="ids" value="01p000000000001AAA">
<span>outboundChangeSetDetailPage</span>`;

describe('テストの HTML の例の確認スクリプト（check-fixtures）', () => {
  it('架空の値だけの例と、リポジトリにある例はすべて通る', () => {
    expect(checkFixtureText('valid.html', VALID)).toEqual([]);

    const result = checkFixtures({ dir: resolve(process.cwd(), 'tests/u2/fixtures') });
    expect(result.errors).toEqual([]);
    expect(result.checked).toBeGreaterThanOrEqual(10);
    expect(checkFixtures({ dir: resolve(process.cwd(), 'tests/u2/no-such-dir') }).errors).toEqual([
      expect.stringContaining('がありません'),
    ]);
  });

  it('example.my.salesforce.com 以外の Salesforce のホスト名があると失敗する', () => {
    for (const host of [
      'acme.my.salesforce.com',
      'acme--dev.sandbox.my.salesforce-setup.com',
      'acme.lightning.force.com',
    ]) {
      expect(checkFixtureText('x.html', `${VALID}<a href="https://${host}/">x</a>`)).toEqual([
        'x.html: example.my.salesforce.com 以外の Salesforce のホスト名があります（1 件）',
      ]);
    }
  });

  it('メールアドレスがあると失敗する', () => {
    expect(checkFixtureText('x.html', `${VALID}<td>someone@example.org</td>`)).toEqual([
      'x.html: メールアドレスがあります（1 件）',
    ]);
  });

  it('0 の並びでない 15 文字か 18 文字の ID があると失敗する', () => {
    expect(checkFixtureText('x.html', `${VALID}<td>0A23k000000XyZ1</td>`)).toEqual([
      'x.html: 0 の並びでない 15 文字か 18 文字の ID があります（1 件）',
    ]);
    expect(checkFixtureText('x.html', `${VALID}<td>01p5g00000AbCdEFGH</td>`)).toHaveLength(1);
  });

  it('32 文字以上の英数字の並び（トークンらしい値）があると失敗する', () => {
    const token = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7';
    expect(checkFixtureText('x.html', `${VALID}<td>${token}</td>`)).toEqual([
      'x.html: 32 文字以上の英数字の並びがあります（1 件）',
    ]);
  });

  it('test- で始まらない隠し項目の値があると失敗する', () => {
    const errors = checkFixtureText(
      'x.html',
      `${VALID}<input name="viewState" type='hidden' value='real-viewstate'><INPUT TYPE=HIDDEN NAME=x VALUE=abc>`,
    );
    expect(errors).toEqual(['x.html: test- で始まらない隠し項目の値があります（2 件）']);
  });
});
