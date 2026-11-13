/**
 * ビルドした changeset-add-assist.js の代わり（結合テスト用）。
 * WXT はビルドのときに、後から読み込む部品の既定の書き出しを main() の戻り値にする
 * （.output/chrome-mv3/page-size-bar.js の末尾と同じ形）。ここではその包み方だけをまね、
 * 中身は本物の entrypoints/changeset-add-assist.ts を使う。
 */
import entry from '../../../entrypoints/changeset-add-assist';

if (typeof entry.main !== 'function') throw new TypeError('unlisted script has no main');

export default entry.main();
