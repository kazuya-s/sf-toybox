import { describe, expect, it } from 'vitest';
import {
  ERROR_MESSAGES,
  addPagePath,
  detailPagePath,
  findColumn,
  isLoginPage,
  isNotFoundPage,
  isPermissionDeniedPage,
  isSalesforceId,
} from '../../../src/salesforce/markers';
import { parsePage } from '../../../src/salesforce/parse';
import { TEST_CHANGE_SET_ID, TEST_ORIGIN, readFixture } from '../helpers/location';

describe('画面の目印の定義（markers、BR1.5）', () => {
  it('詳細画面と追加画面のパスを、ID・種類・rowsperpage つきで作る', () => {
    expect(detailPagePath(TEST_CHANGE_SET_ID)).toBe(
      '/changemgmt/outboundChangeSetDetailPage.apexp?id=0A2000000000001&rowsperpage=1000',
    );
    expect(addPagePath(TEST_CHANGE_SET_ID, 'CustomField')).toBe(
      '/p/mfpkg/AddToPackageFromChangeMgmtUi?id=0A2000000000001&entityType=CustomField&rowsperpage=1000',
    );
    expect(addPagePath(TEST_CHANGE_SET_ID)).toBe(
      '/p/mfpkg/AddToPackageFromChangeMgmtUi?id=0A2000000000001&rowsperpage=1000',
    );
    // 種類の値に記号があっても、パラメータの外に出ない
    expect(addPagePath(TEST_CHANGE_SET_ID, 'a&id=x')).toContain('entityType=a%26id%3Dx');
    expect(isSalesforceId(TEST_CHANGE_SET_ID)).toBe(true);
    expect(isSalesforceId('0A2000000000001AAA')).toBe(true);
    expect(isSalesforceId('0A20000')).toBe(false);
    expect(isSalesforceId('../0A20000000001')).toBe(false);
    expect(isSalesforceId(null)).toBe(false);
  });

  it('ログイン画面の例を、入力欄とパスのどちらからも見分けられる', () => {
    expect(isLoginPage(parsePage(readFixture('login.html')))).toBe(true);
    expect(isLoginPage(parsePage('<p>x</p>'), `${TEST_ORIGIN}/secur/login_portal.jsp`)).toBe(true);
    expect(isLoginPage(parsePage('<p>x</p>'), 'not a url')).toBe(false);
  });

  it('権限がない旨の画面と、対象のデータがない旨の画面を見分けられる', () => {
    const denied = parsePage(readFixture('permission-denied.html'));
    const notFound = parsePage(readFixture('not-found.html'));
    const deniedByTitle = parsePage('<span class="errorTitle">権限が不十分です</span>');

    expect(isPermissionDeniedPage(denied)).toBe(true);
    expect(isPermissionDeniedPage(deniedByTitle)).toBe(true);
    expect(isNotFoundPage(notFound)).toBe(true);
    expect(isPermissionDeniedPage(notFound)).toBe(false);
    expect(isNotFoundPage(denied)).toBe(false);
  });

  it('ふつうの詳細画面は、ログイン・権限・データなしのどれにも当たらない', () => {
    const detail = parsePage(readFixture('detail-single.html'));

    expect(isLoginPage(detail, `${TEST_ORIGIN}${detailPagePath(TEST_CHANGE_SET_ID)}`)).toBe(false);
    expect(isPermissionDeniedPage(detail)).toBe(false);
    expect(isNotFoundPage(detail)).toBe(false);
    expect(findColumn(['Action', 'name', 'Type'], ['Name', '名前'])).toBe(1);
    expect(findColumn(['Action'], ['Name'])).toBe(-1);
  });

  it('message の識別子は、すべて固定の文字で、URL や名前が入る形がない', () => {
    for (const message of Object.values(ERROR_MESSAGES)) {
      expect(message).toMatch(/^(salesforce|changeset)\.[a-zA-Z]+$/);
    }
    expect(new Set(Object.values(ERROR_MESSAGES)).size).toBe(Object.keys(ERROR_MESSAGES).length);
  });
});
