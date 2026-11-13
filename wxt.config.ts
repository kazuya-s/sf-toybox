import { relative } from 'node:path';
import { defineConfig } from 'wxt';
import type { Plugin } from 'vite';
import { SALESFORCE_MATCHES } from './src/shared/salesforce-matches';

/** 後から読み込む件数バーの部品（entrypoints/page-size-bar.ts）の入口の名前 */
const PAGE_SIZE_BAR_ENTRY = 'page-size-bar';
/** 後から読み込む追加支援の部品（entrypoints/changeset-add-assist.ts）の入口の名前（U4） */
const CHANGESET_ADD_ASSIST_ENTRY = 'changeset-add-assist';
/** 入口から import() で読み込むため、ES モジュールで出力する部品 */
const LAZY_ENTRIES: readonly string[] = [PAGE_SIZE_BAR_ENTRY, CHANGESET_ADD_ASSIST_ENTRY];

/**
 * ビルドの組ごとに、出力した部品（chunk）と、その中に入ったモジュールの一覧を
 * `.vite/modules-<組の名前>.json` に書き出す。
 * WXT の入口は 1 つずつ別のビルドになり、Vite の部品の一覧には部品の中に
 * まとめたモジュールが載らないため、scripts/check-manifest.mjs が
 * 「入口に React が入っていないこと」を確かめるのに使う（cicd-pipeline.md 段階 6）。
 */
function moduleListPlugin(groupName: string, root: string): Plugin {
  return {
    name: 'sftoybox:module-list',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle)
        .filter((output) => output.type === 'chunk')
        .map((chunk) => ({
          file: chunk.fileName,
          name: chunk.name,
          isEntry: chunk.isEntry,
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          modules: chunk.moduleIds.map((id) => relative(root, id).split('\\').join('/')),
        }));
      this.emitFile({
        type: 'asset',
        fileName: `.vite/modules-${groupName}.json`,
        source: JSON.stringify(chunks, null, 2),
      });
    },
  };
}

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // 自動の import は使わず、各ファイルで明示的に import する
  imports: false,
  manifest: {
    name: '__MSG_ext_name__',
    description: '__MSG_ext_description__',
    default_locale: 'en',
    minimum_chrome_version: '120',
    permissions: ['storage'],
    // host_permissions は書かない（U1 は通信しない。security-design.md §2）
    web_accessible_resources: [
      {
        resources: [`${PAGE_SIZE_BAR_ENTRY}.js`, `${CHANGESET_ADD_ASSIST_ENTRY}.js`],
        matches: [...SALESFORCE_MATCHES],
        use_dynamic_url: true,
      },
    ],
  },
  zip: {
    // 確認用の一覧はストアに出す zip に入れない
    exclude: ['.vite/**'],
  },
  hooks: {
    'vite:build:extendConfig': (entrypoints, viteConfig) => {
      const groupName = entrypoints.map((entrypoint) => entrypoint.name).join('+');
      viteConfig.build ??= {};
      // Vite の部品の一覧。組ごとに別のファイルにして、上書きされないようにする
      viteConfig.build.manifest = `.vite/manifest-${groupName}.json`;
      viteConfig.plugins ??= [];
      viteConfig.plugins.push(moduleListPlugin(groupName, process.cwd()));

      // 件数バーと追加支援の部品は、入口から import() で読み込めるよう ES モジュールで出力する
      const isLazyEntry =
        entrypoints.length === 1 && LAZY_ENTRIES.includes(entrypoints[0]?.name ?? '');
      if (isLazyEntry && viteConfig.build.lib) {
        viteConfig.build.lib.formats = ['es'];
      }
    },
  },
});
