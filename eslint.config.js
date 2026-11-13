// @ts-check
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/** U1 のコードで使わない通信の機能（NFR1.1、NFR7.3、cicd-pipeline.md 段階 2） */
const NETWORK_GLOBALS = [
  { name: 'fetch', message: 'U1 のコードでは通信をしません（NFR1.1、NFR7.3）。' },
  { name: 'XMLHttpRequest', message: 'U1 のコードでは通信をしません（NFR1.1、NFR7.3）。' },
  { name: 'WebSocket', message: 'U1 のコードでは通信をしません（NFR1.1、NFR7.3）。' },
];

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
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'innerHTML は使いません（NFR3.3）。' },
        { property: 'outerHTML', message: 'outerHTML は使いません（NFR3.3）。' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'entrypoints/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
);
