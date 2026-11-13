/**
 * テストで使うパス。tests/u2/fixtures/ の「次のページ」のリンクと同じ値。
 */
import { addPagePath, detailPagePath } from '../../../src/salesforce/markers';
import { TEST_CHANGE_SET_ID } from './location';

export const DETAIL_PAGE_1 = detailPagePath(TEST_CHANGE_SET_ID);
export const DETAIL_PAGE_2 = `${DETAIL_PAGE_1}&lsr=2`;
export const DETAIL_PAGE_3 = `${DETAIL_PAGE_1}&lsr=4`;

/** 種類を指定しない追加画面（追加の前の確認） */
export const ADD_PAGE_ANY = addPagePath(TEST_CHANGE_SET_ID);
export const ADD_PAGE_1 = addPagePath(TEST_CHANGE_SET_ID, 'CustomField');
export const ADD_PAGE_2 = `${ADD_PAGE_1}&lsr=2`;
/** 追加画面のフォームの送り先 */
export const ADD_FORM_ACTION = '/p/mfpkg/AddToPackageFromChangeMgmtUi';
