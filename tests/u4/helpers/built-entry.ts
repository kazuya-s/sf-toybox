/**
 * Stand-in for the built changeset-add-assist.js (for the integration test).
 * At build time WXT makes a lazily loaded chunk's default export the return value of main()
 * (same shape as the end of .output/chrome-mv3/page-size-bar.js). This mimics only that wrapping;
 * the content is the real entrypoints/changeset-add-assist.ts.
 */
import entry from '../../../entrypoints/changeset-add-assist';

if (typeof entry.main !== 'function') throw new TypeError('unlisted script has no main');

export default entry.main();
