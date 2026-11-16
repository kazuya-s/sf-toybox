/**
 * Paths used in tests. Same values as the "Next Page" links in tests/u2/fixtures/.
 */
import { addPagePath, detailPagePath } from '../../../src/salesforce/markers';
import { TEST_CHANGE_SET_ID } from './location';

export const DETAIL_PAGE_1 = detailPagePath(TEST_CHANGE_SET_ID);
export const DETAIL_PAGE_2 = `${DETAIL_PAGE_1}&lsr=2`;
export const DETAIL_PAGE_3 = `${DETAIL_PAGE_1}&lsr=4`;

/** Add page without a type (pre-add check) */
export const ADD_PAGE_ANY = addPagePath(TEST_CHANGE_SET_ID);
export const ADD_PAGE_1 = addPagePath(TEST_CHANGE_SET_ID, 'CustomField');
export const ADD_PAGE_2 = `${ADD_PAGE_1}&lsr=2`;
/** Destination of the Add page form */
export const ADD_FORM_ACTION = '/p/mfpkg/AddToPackageFromChangeMgmtUi';
