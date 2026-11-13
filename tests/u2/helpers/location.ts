/**
 * テストの中の location を、架空の組織の画面にする（unit-test-instructions.md「テストの道具と設定」）。
 * ホスト名は cicd-pipeline.md「テストの HTML の例」の架空の値だけを使う。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const TEST_ORIGIN = 'https://example.my.salesforce.com';

/** 架空の変更セットの ID（0 の並び） */
export const TEST_CHANGE_SET_ID = '0A2000000000001';

type HappyDomWindow = { happyDOM: { setURL(url: string): void } };

/** location.origin を TEST_ORIGIN にする */
export function useSalesforceLocation(
  path = '/changemgmt/outboundChangeSetDetailPage.apexp',
): void {
  (window as unknown as HappyDomWindow).happyDOM.setURL(`${TEST_ORIGIN}${path}`);
}

/** tests/u2/fixtures/ の手で書いた HTML の例を読む */
export function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), 'tests/u2/fixtures', name), 'utf8');
}
