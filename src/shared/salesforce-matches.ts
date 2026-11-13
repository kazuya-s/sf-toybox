/**
 * 拡張機能を組み込む Salesforce のドメイン（NFR2.2、security-design.md §2）。
 * content script の matches と web_accessible_resources の matches の両方に使う。
 * 変えるときは scripts/check-manifest.mjs の許可の一覧と docs/store/permissions.md も直す。
 */
export const SALESFORCE_MATCHES = [
  'https://*.salesforce.com/*',
  'https://*.force.com/*',
  'https://*.salesforce-setup.com/*',
] as const;
