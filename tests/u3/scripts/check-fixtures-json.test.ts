import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  JSON_FIXTURE_DIRS,
  checkJsonFixtureText,
  checkJsonFixtures,
} from '../../../scripts/check-fixtures.mjs';

/** 架空の値だけの例（cicd-pipeline.md「テストのデータ」） */
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

describe('テストの JSON のデータの確認（check-fixtures の JSON の調べ）', () => {
  it('架空の値だけなら通り、リポジトリの例もすべて通る（ないフォルダは飛ばす）', () => {
    expect(checkJsonFixtureText('valid.json', fixture())).toEqual([]);

    const dirs = JSON_FIXTURE_DIRS.map((dir) => resolve(process.cwd(), dir));
    const result = checkJsonFixtures({ dirs: [...dirs, resolve(process.cwd(), 'tests/u3/none')] });
    expect(result.errors).toEqual([]);
    expect(result.checked).toBeGreaterThanOrEqual(4);
    expect(JSON_FIXTURE_DIRS).toEqual(['tests/u3/fixtures', 'tests/u4/fixtures']);
  });

  it('example.my.salesforce.com 以外の Salesforce のホスト名があると失敗する', () => {
    expect(
      checkJsonFixtureText('x.json', fixture({ link: 'https://acme.my.salesforce.com/' })),
    ).toEqual(['x.json: example.my.salesforce.com 以外の Salesforce のホスト名があります（1 件）']);
  });

  it('メールアドレスと 32 文字以上の英数字の並びがあると失敗する', () => {
    expect(checkJsonFixtureText('x.json', fixture({ owner: 'someone@example.org' }))).toEqual([
      'x.json: メールアドレスがあります（1 件）',
    ]);
    expect(
      checkJsonFixtureText('x.json', fixture({ token: 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7' })),
    ).toEqual(['x.json: 32 文字以上の英数字の並びがあります（1 件）']);
  });

  it('0 の並びでない 15 文字か 18 文字の ID があると失敗する', () => {
    const changeSet = { changeSetId: '0A23k000000XyZ1', name: 'TestChangeSet', status: 'open' };
    expect(checkJsonFixtureText('x.json', fixture({ changeSet }))).toEqual([
      'x.json: 0 の並びでない 15 文字か 18 文字の ID があります（1 件）',
    ]);
  });

  it('名前の欄が Test で始まらないと失敗する（null は除く。キーは調べない）。JSON でないものも失敗', () => {
    const components = [
      { componentType: 'Apex Class', apiName: 'RealClass', parentObject: null },
      { componentType: 'Custom Field', apiName: 'Test__c', parentObject: 'Account' },
    ];
    expect(checkJsonFixtureText('x.json', fixture({ components }))).toEqual([
      'x.json: 名前の欄（name・apiName・parentObject）に Test で始まらない値があります（2 件）',
    ]);
    expect(checkJsonFixtureText('x.json', fixture({ Account: 'TestValue' }))).toEqual([]);
    expect(checkJsonFixtureText('x.json', '{ broken')).toEqual(['x.json: JSON として読めません']);
  });
});
