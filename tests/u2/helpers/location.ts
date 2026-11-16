/**
 * Makes location in tests a fake org page (unit-test-instructions.md "Test tools and setup").
 * Uses only the fake host name from cicd-pipeline.md "Test HTML fixtures".
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const TEST_ORIGIN = 'https://example.my.salesforce.com';

/** Fake change set ID (all zeros) */
export const TEST_CHANGE_SET_ID = '0A2000000000001';

type HappyDomWindow = { happyDOM: { setURL(url: string): void } };

/** Sets location.origin to TEST_ORIGIN */
export function useSalesforceLocation(
  path = '/changemgmt/outboundChangeSetDetailPage.apexp',
): void {
  (window as unknown as HappyDomWindow).happyDOM.setURL(`${TEST_ORIGIN}${path}`);
}

/** Reads a hand-written HTML fixture from tests/u2/fixtures/ */
export function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), 'tests/u2/fixtures', name), 'utf8');
}
