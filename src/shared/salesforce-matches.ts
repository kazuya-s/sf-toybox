/**
 * Salesforce domains the extension runs on (NFR2.2, security-design.md §2).
 * Used for both the content script matches and the web_accessible_resources matches.
 * When changing them, also update the allow list in scripts/check-manifest.mjs and docs/store/permissions.md.
 */
export const SALESFORCE_MATCHES = [
  'https://*.salesforce.com/*',
  'https://*.force.com/*',
  'https://*.salesforce-setup.com/*',
] as const;
