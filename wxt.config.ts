import { relative } from 'node:path';
import { defineConfig } from 'wxt';
import type { Plugin } from 'vite';
import { SALESFORCE_MATCHES } from './src/shared/salesforce-matches';

/** Entry name of the lazily loaded page-size bar (entrypoints/page-size-bar.ts) */
const PAGE_SIZE_BAR_ENTRY = 'page-size-bar';
/** Entry name of the lazily loaded add-assist widget (entrypoints/changeset-add-assist.ts) (U4) */
const CHANGESET_ADD_ASSIST_ENTRY = 'changeset-add-assist';
/** Chunks emitted as ES modules because the entry loads them with import() */
const LAZY_ENTRIES: readonly string[] = [PAGE_SIZE_BAR_ENTRY, CHANGESET_ADD_ASSIST_ENTRY];

/**
 * For each build group, writes the emitted chunks and the modules inside them to
 * `.vite/modules-<group name>.json`.
 * WXT builds each entry separately, and the Vite chunk list does not include modules
 * bundled inside a chunk, so scripts/check-manifest.mjs uses this to verify
 * that "React is not in the entry" (cicd-pipeline.md stage 6).
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
  // No auto-imports; each file imports explicitly
  imports: false,
  manifest: {
    name: '__MSG_ext_name__',
    description: '__MSG_ext_description__',
    default_locale: 'en',
    minimum_chrome_version: '120',
    permissions: ['storage'],
    // No host_permissions (U1 makes no network requests; security-design.md §2)
    web_accessible_resources: [
      {
        resources: [`${PAGE_SIZE_BAR_ENTRY}.js`, `${CHANGESET_ADD_ASSIST_ENTRY}.js`],
        matches: [...SALESFORCE_MATCHES],
        use_dynamic_url: true,
      },
    ],
  },
  zip: {
    // The check-only lists are left out of the store zip
    exclude: ['.vite/**'],
  },
  hooks: {
    'vite:build:extendConfig': (entrypoints, viteConfig) => {
      const groupName = entrypoints.map((entrypoint) => entrypoint.name).join('+');
      viteConfig.build ??= {};
      // Vite chunk list. One file per group so they do not overwrite each other
      viteConfig.build.manifest = `.vite/manifest-${groupName}.json`;
      viteConfig.plugins ??= [];
      viteConfig.plugins.push(moduleListPlugin(groupName, process.cwd()));

      // The page-size bar and add-assist chunks are emitted as ES modules so the entry can import() them
      const isLazyEntry =
        entrypoints.length === 1 && LAZY_ENTRIES.includes(entrypoints[0]?.name ?? '');
      if (isLazyEntry && viteConfig.build.lib) {
        viteConfig.build.lib.formats = ['es'];
      }
    },
  },
});
