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

describe('Page markers (markers, BR1.5)', () => {
  it('builds the detail and Add page paths with the ID, type and rowsperpage', () => {
    expect(detailPagePath(TEST_CHANGE_SET_ID)).toBe(
      '/changemgmt/outboundChangeSetDetailPage.apexp?id=0A2000000000001&rowsperpage=1000',
    );
    expect(addPagePath(TEST_CHANGE_SET_ID, 'CustomField')).toBe(
      '/p/mfpkg/AddToPackageFromChangeMgmtUi?id=0A2000000000001&entityType=CustomField&rowsperpage=1000',
    );
    expect(addPagePath(TEST_CHANGE_SET_ID)).toBe(
      '/p/mfpkg/AddToPackageFromChangeMgmtUi?id=0A2000000000001&rowsperpage=1000',
    );
    // Symbols in the type value never escape the parameter
    expect(addPagePath(TEST_CHANGE_SET_ID, 'a&id=x')).toContain('entityType=a%26id%3Dx');
    expect(isSalesforceId(TEST_CHANGE_SET_ID)).toBe(true);
    expect(isSalesforceId('0A2000000000001AAA')).toBe(true);
    expect(isSalesforceId('0A20000')).toBe(false);
    expect(isSalesforceId('../0A20000000001')).toBe(false);
    expect(isSalesforceId(null)).toBe(false);
  });

  it('recognizes the login page from either its inputs or its path', () => {
    expect(isLoginPage(parsePage(readFixture('login.html')))).toBe(true);
    expect(isLoginPage(parsePage('<p>x</p>'), `${TEST_ORIGIN}/secur/login_portal.jsp`)).toBe(true);
    expect(isLoginPage(parsePage('<p>x</p>'), 'not a url')).toBe(false);
  });

  it('recognizes the insufficient-privileges page and the data-not-available page', () => {
    const denied = parsePage(readFixture('permission-denied.html'));
    const notFound = parsePage(readFixture('not-found.html'));
    const deniedByTitle = parsePage('<span class="errorTitle">権限が不十分です</span>');

    expect(isPermissionDeniedPage(denied)).toBe(true);
    expect(isPermissionDeniedPage(deniedByTitle)).toBe(true);
    expect(isNotFoundPage(notFound)).toBe(true);
    expect(isPermissionDeniedPage(notFound)).toBe(false);
    expect(isNotFoundPage(denied)).toBe(false);
  });

  it('a normal detail page matches none of login, privileges or data not available', () => {
    const detail = parsePage(readFixture('detail-single.html'));

    expect(isLoginPage(detail, `${TEST_ORIGIN}${detailPagePath(TEST_CHANGE_SET_ID)}`)).toBe(false);
    expect(isPermissionDeniedPage(detail)).toBe(false);
    expect(isNotFoundPage(detail)).toBe(false);
    expect(findColumn(['Action', 'name', 'Type'], ['Name', '名前'])).toBe(1);
    expect(findColumn(['Action'], ['Name'])).toBe(-1);
  });

  it('message IDs are all fixed strings with no room for URLs or names', () => {
    for (const message of Object.values(ERROR_MESSAGES)) {
      expect(message).toMatch(/^(salesforce|changeset)\.[a-zA-Z]+$/);
    }
    expect(new Set(Object.values(ERROR_MESSAGES)).size).toBe(Object.keys(ERROR_MESSAGES).length);
  });
});
