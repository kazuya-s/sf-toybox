/**
 * 拡張機能の中のメッセージの窓口の名前（contract-summary.md C4、security-design.md §4）。
 * U1 の sftoybox/page-info は src/page/page-info-responder.ts の PAGE_INFO_CHANNEL にある。
 * U3 の窓口はここにまとめる（U1 のファイルは変えない）。
 */

/** ツールバーの画面 → ページ側: 変更セットの中身の一覧を頼む */
export const CHANGESET_COMPONENTS_CHANNEL = 'sftoybox/changeset/components';

/** ページ側 → ツールバーの画面: 一覧の読み込みの進み具合 */
export const CHANGESET_PROGRESS_CHANNEL = 'sftoybox/changeset/progress';
