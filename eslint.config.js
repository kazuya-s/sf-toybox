// @ts-check
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// 禁止の一覧（U1・U2 の security-design.md、cicd-pipeline.md 段階 2）。
// ESLint の設定では、後のブロックで同じ規則を書くと前の一覧を置き換えるため、
// 禁止の一覧はここにまとめ、各ブロックで合わせて広げて書く。U3・U4 はここに足す。

/** 通信の機能（NFR1.1、NFR4.1）。例外は src/salesforce/connection.ts の fetch だけ */
const NETWORK_GLOBALS = [
  { name: 'fetch', message: '通信は src/salesforce/connection.ts だけで行います（NFR1.1）。' },
  {
    name: 'XMLHttpRequest',
    message: '通信は src/salesforce/connection.ts の fetch だけで行います（NFR1.1）。',
  },
  {
    name: 'WebSocket',
    message: '通信は src/salesforce/connection.ts の fetch だけで行います（NFR1.1）。',
  },
];

/** 保存の手段（U2 NFR1.2） */
const STORAGE_GLOBALS = ['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({
  name,
  message: 'U2 のコードでは保存をしません（NFR1.2）。',
}));

/** すべてのファイルで使わないプロパティ（U1 NFR3.3） */
const BASE_RESTRICTED_PROPERTIES = [
  { property: 'innerHTML', message: 'innerHTML は使いません（NFR3.3）。' },
  { property: 'outerHTML', message: 'outerHTML は使いません（NFR3.3）。' },
];

/** window. や globalThis. を付けた通信の書き方（U2 NFR1.1） */
const NETWORK_PROPERTIES = ['window', 'globalThis'].flatMap((object) =>
  ['fetch', 'XMLHttpRequest', 'WebSocket'].map((property) => ({
    object,
    property,
    message: '通信は src/salesforce/connection.ts の fetch だけで行います（NFR1.1）。',
  })),
);

/** 保存とクッキーの手段（U2 NFR1.2、NFR2.2） */
const STORAGE_PROPERTIES = [
  { object: 'chrome', property: 'storage', message: 'U2 のコードでは保存をしません（NFR1.2）。' },
  {
    object: 'document',
    property: 'cookie',
    message: 'クッキーは読みません（NFR2.2）。',
  },
  { object: 'chrome', property: 'cookies', message: 'クッキーは読みません（NFR2.2）。' },
  ...['window', 'globalThis'].flatMap((object) =>
    ['localStorage', 'sessionStorage', 'indexedDB'].map((property) => ({
      object,
      property,
      message: 'U2 のコードでは保存をしません（NFR1.2）。',
    })),
  ),
];

/** ホスト名で処理を分けない（U2 NFR8.1）。window.location.host の形も含む */
const HOST_SYNTAX = [
  {
    selector: "MemberExpression[object.name='location'][property.name=/^(hostname|host)$/]",
    message: '送り先は location.origin だけで作ります（NFR8.1）。',
  },
  {
    selector:
      "MemberExpression[object.property.name='location'][property.name=/^(hostname|host)$/]",
    message: '送り先は location.origin だけで作ります（NFR8.1）。',
  },
];

/** U2 のファイル（Salesforce とのやり取りと変更セット） */
const U2_FILES = ['src/salesforce/**/*.{ts,tsx}', 'src/changeset/**/*.{ts,tsx}'];
const U2_CONNECTION_FILE = 'src/salesforce/connection.ts';

/** U2 のファイルに掛ける規則。connection.ts では globals だけを差し替える */
function u2Rules(globals) {
  return {
    'no-restricted-globals': ['error', ...globals],
    'no-restricted-properties': [
      'error',
      ...BASE_RESTRICTED_PROPERTIES,
      ...NETWORK_PROPERTIES,
      ...STORAGE_PROPERTIES,
    ],
    'no-restricted-syntax': ['error', ...HOST_SYNTAX],
  };
}

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      '.output/',
      '.wxt/',
      'coverage/',
      'aidlc/',
      '.claude/',
      'package-lock.json',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // 外部のコードや文字列をコードとして動かさない（NFR3.2）
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // 文字列を HTML として扱わない（NFR3.3）
      'react/no-danger': 'error',
      'no-restricted-properties': ['error', ...BASE_RESTRICTED_PROPERTIES],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'entrypoints/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
    },
  },
  {
    files: U2_FILES,
    rules: u2Rules([...NETWORK_GLOBALS, ...STORAGE_GLOBALS]),
  },
  {
    files: [U2_CONNECTION_FILE],
    rules: u2Rules([
      ...NETWORK_GLOBALS.filter((entry) => entry.name !== 'fetch'),
      ...STORAGE_GLOBALS,
    ]),
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
);
