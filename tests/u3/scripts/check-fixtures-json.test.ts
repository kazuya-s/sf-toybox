import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  JSON_FIXTURE_DIRS,
  checkJsonFixtureText,
  checkJsonFixtures,
} from '../../../scripts/check-fixtures.mjs';

/** Example with fake values only (cicd-pipeline.md "Test data") */
function fixture(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    changeSet: { changeSetId: '0A2000000000001', name: 'TestChangeSet', status: 'open' },
    components: [
      { componentType: 'Apex Class', apiName: 'TestClass', parentObject: null },
      { componentType: 'Custom Field', apiName: 'Test__c', parentObject: 'TestObject__c' },
    ],
    link: 'https://example.my.salesforce.com/0A2000000000001',
    ...overrides,
  });
}

describe('Test JSON data check (JSON checks in check-fixtures)', () => {
  it('passes with fake values only, and every repository example passes (missing folders skipped)', () => {
    expect(checkJsonFixtureText('valid.json', fixture())).toEqual([]);

    const dirs = JSON_FIXTURE_DIRS.map((dir) => resolve(process.cwd(), dir));
    const result = checkJsonFixtures({ dirs: [...dirs, resolve(process.cwd(), 'tests/u3/none')] });
    expect(result.errors).toEqual([]);
    expect(result.checked).toBeGreaterThanOrEqual(4);
    expect(JSON_FIXTURE_DIRS).toEqual(['tests/u3/fixtures', 'tests/u4/fixtures']);
  });

  it('fails on a Salesforce host name other than example.my.salesforce.com', () => {
    expect(
      checkJsonFixtureText('x.json', fixture({ link: 'https://acme.my.salesforce.com/' })),
    ).toEqual(['x.json: has a Salesforce host name other than example.my.salesforce.com (1)']);
  });

  it('fails on an email address and an alphanumeric run of 32 or more characters', () => {
    expect(checkJsonFixtureText('x.json', fixture({ owner: 'someone@example.org' }))).toEqual([
      'x.json: has an email address (1)',
    ]);
    expect(
      checkJsonFixtureText('x.json', fixture({ token: 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7' })),
    ).toEqual(['x.json: has an alphanumeric run of 32 or more characters (1)']);
  });

  it('fails on a 15- or 18-character ID that is not all zeros', () => {
    const changeSet = { changeSetId: '0A23k000000XyZ1', name: 'TestChangeSet', status: 'open' };
    expect(checkJsonFixtureText('x.json', fixture({ changeSet }))).toEqual([
      'x.json: has a 15- or 18-character ID that is not all zeros (1)',
    ]);
  });

  it('fails when a name field does not start with Test (null excluded; keys not checked); non-JSON also fails', () => {
    const components = [
      { componentType: 'Apex Class', apiName: 'RealClass', parentObject: null },
      { componentType: 'Custom Field', apiName: 'Test__c', parentObject: 'Account' },
    ];
    expect(checkJsonFixtureText('x.json', fixture({ components }))).toEqual([
      'x.json: has a value not starting with Test in a name field (name, apiName, parentObject) (2)',
    ]);
    expect(checkJsonFixtureText('x.json', fixture({ Account: 'TestValue' }))).toEqual([]);
    expect(checkJsonFixtureText('x.json', '{ broken')).toEqual([
      'x.json: cannot be parsed as JSON',
    ]);
  });
});
