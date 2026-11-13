/**
 * manifest の確認スクリプトのテストに使う、小さな偽のビルド結果（unit-test-instructions.md「テストのデータ」）。
 * 実際のビルド（WXT）の形に合わせ、Vite の部品の一覧は .vite/manifest-<組>.json に、
 * モジュールの一覧は .vite/modules-<組>.json に置く。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const SALESFORCE_MATCHES = [
  'https://*.salesforce.com/*',
  'https://*.force.com/*',
  'https://*.salesforce-setup.com/*',
];

export type FakeBuild = {
  manifest: Record<string, unknown> & {
    permissions: string[];
    content_scripts: { matches: string[]; js: string[] }[];
    web_accessible_resources: {
      resources: string[];
      matches: string[];
      use_dynamic_url: boolean;
    }[];
  };
  viteManifests: Record<string, Record<string, unknown>>;
  moduleLists: Record<
    string,
    { file: string; name: string; isEntry: boolean; imports: string[]; modules: string[] }[]
  >;
  files: Record<string, string>;
  permissionsDoc: string;
};

export function validBuild(): FakeBuild {
  return {
    manifest: {
      manifest_version: 3,
      name: '__MSG_ext_name__',
      default_locale: 'en',
      permissions: ['storage'],
      content_scripts: [
        { matches: [...SALESFORCE_MATCHES], js: ['content-scripts/salesforce.js'] },
      ],
      web_accessible_resources: [
        {
          resources: ['page-size-bar.js', 'chunks/*.js', 'assets/bar.css'],
          matches: [...SALESFORCE_MATCHES],
          use_dynamic_url: true,
        },
      ],
    },
    viteManifests: {
      salesforce: {
        'virtual:entry?/entrypoints/salesforce.content.ts': {
          file: 'content-scripts/salesforce.js',
          name: 'salesforce.content',
          isEntry: true,
        },
      },
      'page-size-bar': {
        'virtual:entry?/entrypoints/page-size-bar.ts': {
          file: 'page-size-bar.js',
          name: 'page-size-bar',
          isEntry: true,
          imports: ['_react.js'],
          css: ['assets/bar.css'],
        },
        '_react.js': { file: 'chunks/react-abc123.js', name: 'react' },
      },
    },
    moduleLists: {
      salesforce: [
        {
          file: 'content-scripts/salesforce.js',
          name: 'salesforce.content',
          isEntry: true,
          imports: [],
          modules: ['src/page/page-context.ts', 'entrypoints/salesforce.content.ts'],
        },
      ],
    },
    files: {
      'content-scripts/salesforce.js':
        '/*! sf-toybox | license https://example.com/LICENSE */\nconst u = chrome.runtime.getURL("/page-size-bar.js");\nimport(u);\n',
      'page-size-bar.js':
        'import "./chunks/react-abc123.js";\nexport default { mountPageSizeBar() {} };\n',
      'chunks/react-abc123.js': 'export const ns = "http://www.w3.org/2000/svg";\n',
      'assets/bar.css': ':host{display:block;background:url("data:image/svg+xml,%3Csvg%3E")}\n',
      'options.html': '<!doctype html><script type="module" src="./chunks/options.js"></script>\n',
    },
    permissionsDoc: '# 権限\n\n| `storage` | 設定を保存するため |\n',
  };
}

/** 偽のビルド結果をフォルダに書き出し、確認スクリプトに渡す場所を返す */
export function writeBuild(
  root: string,
  build: FakeBuild,
): { outDir: string; permissionsDoc: string } {
  const outDir = join(root, 'chrome-mv3');
  const write = (path: string, content: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  write(join(outDir, 'manifest.json'), JSON.stringify(build.manifest));
  for (const [group, manifest] of Object.entries(build.viteManifests)) {
    write(join(outDir, '.vite', `manifest-${group}.json`), JSON.stringify(manifest));
  }
  for (const [group, list] of Object.entries(build.moduleLists)) {
    write(join(outDir, '.vite', `modules-${group}.json`), JSON.stringify(list));
  }
  for (const [file, content] of Object.entries(build.files)) write(join(outDir, file), content);
  const permissionsDoc = join(root, 'permissions.md');
  write(permissionsDoc, build.permissionsDoc);
  return { outDir, permissionsDoc };
}
