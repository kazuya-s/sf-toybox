import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFixtureText, checkFixtures } from '../../../scripts/check-fixtures.mjs';

/** Example with fake values only (cicd-pipeline.md "Test HTML fixtures") */
const VALID = `<!doctype html>
<a href="https://example.my.salesforce.com/0A2000000000001">TestChangeSet</a>
<input type="hidden" name="_CONFIRMATIONTOKEN" value="test-token">
<input type="checkbox" name="ids" value="01p000000000001AAA">
<span>outboundChangeSetDetailPage</span>`;

describe('Test HTML fixture check script (check-fixtures)', () => {
  it('passes for fake-value examples and every fixture in the repository', () => {
    expect(checkFixtureText('valid.html', VALID)).toEqual([]);

    const result = checkFixtures({ dir: resolve(process.cwd(), 'tests/u2/fixtures') });
    expect(result.errors).toEqual([]);
    expect(result.checked).toBeGreaterThanOrEqual(10);
    expect(checkFixtures({ dir: resolve(process.cwd(), 'tests/u2/no-such-dir') }).errors).toEqual([
      expect.stringContaining('does not exist'),
    ]);
  });

  it('fails on a Salesforce host name other than example.my.salesforce.com', () => {
    for (const host of [
      'acme.my.salesforce.com',
      'acme--dev.sandbox.my.salesforce-setup.com',
      'acme.lightning.force.com',
    ]) {
      expect(checkFixtureText('x.html', `${VALID}<a href="https://${host}/">x</a>`)).toEqual([
        'x.html: has a Salesforce host name other than example.my.salesforce.com (1)',
      ]);
    }
  });

  it('fails on an email address', () => {
    expect(checkFixtureText('x.html', `${VALID}<td>someone@example.org</td>`)).toEqual([
      'x.html: has an email address (1)',
    ]);
  });

  it('fails on a 15- or 18-character ID that is not all zeros', () => {
    expect(checkFixtureText('x.html', `${VALID}<td>0A23k000000XyZ1</td>`)).toEqual([
      'x.html: has a 15- or 18-character ID that is not all zeros (1)',
    ]);
    expect(checkFixtureText('x.html', `${VALID}<td>01p5g00000AbCdEFGH</td>`)).toHaveLength(1);
  });

  it('fails on an alphanumeric run of 32 or more characters (token-like value)', () => {
    const token = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7';
    expect(checkFixtureText('x.html', `${VALID}<td>${token}</td>`)).toEqual([
      'x.html: has an alphanumeric run of 32 or more characters (1)',
    ]);
  });

  it('fails on a hidden field value that does not start with test-', () => {
    const errors = checkFixtureText(
      'x.html',
      `${VALID}<input name="viewState" type='hidden' value='real-viewstate'><INPUT TYPE=HIDDEN NAME=x VALUE=abc>`,
    );
    expect(errors).toEqual(['x.html: has a hidden field value that does not start with test- (2)']);
  });
});
