// @ts-check
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// Ban lists (U1/U2 security-design.md, cicd-pipeline.md stage 2).
// In ESLint flat config a later block that sets the same rule replaces the earlier list,
// so the lists live here and each block spreads them together. U3/U4 add to these.

/** Network APIs (NFR1.1, NFR4.1). The only exception is fetch in src/salesforce/connection.ts */
const NETWORK_GLOBALS = [
  {
    name: 'fetch',
    message: 'Network calls are made only in src/salesforce/connection.ts (NFR1.1).',
  },
  {
    name: 'XMLHttpRequest',
    message: 'Network calls are made only by fetch in src/salesforce/connection.ts (NFR1.1).',
  },
  {
    name: 'WebSocket',
    message: 'Network calls are made only by fetch in src/salesforce/connection.ts (NFR1.1).',
  },
];

/** Storage APIs (U2 NFR1.2) */
const STORAGE_GLOBALS = ['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({
  name,
  message: 'This code does not store data (NFR1.2).',
}));

/** Properties banned in every file (U1 NFR3.3) */
const BASE_RESTRICTED_PROPERTIES = [
  { property: 'innerHTML', message: 'Do not use innerHTML (NFR3.3).' },
  { property: 'outerHTML', message: 'Do not use outerHTML (NFR3.3).' },
];

/** Network calls written with window. or globalThis. (U2 NFR1.1) */
const NETWORK_PROPERTIES = ['window', 'globalThis'].flatMap((object) =>
  ['fetch', 'XMLHttpRequest', 'WebSocket'].map((property) => ({
    object,
    property,
    message: 'Network calls are made only by fetch in src/salesforce/connection.ts (NFR1.1).',
  })),
);

/** Storage and cookie APIs (U2 NFR1.2, NFR2.2) */
const STORAGE_PROPERTIES = [
  { object: 'chrome', property: 'storage', message: 'This code does not store data (NFR1.2).' },
  {
    object: 'document',
    property: 'cookie',
    message: 'Cookies are never read (NFR2.2).',
  },
  { object: 'chrome', property: 'cookies', message: 'Cookies are never read (NFR2.2).' },
  ...['window', 'globalThis'].flatMap((object) =>
    ['localStorage', 'sessionStorage', 'indexedDB'].map((property) => ({
      object,
      property,
      message: 'This code does not store data (NFR1.2).',
    })),
  ),
];

/** Never branch on the host name (U2 NFR8.1). Includes the window.location.host form */
const HOST_SYNTAX = [
  {
    selector: "MemberExpression[object.name='location'][property.name=/^(hostname|host)$/]",
    message: 'Build request URLs from location.origin only (NFR8.1).',
  },
  {
    selector:
      "MemberExpression[object.property.name='location'][property.name=/^(hostname|host)$/]",
    message: 'Build request URLs from location.origin only (NFR8.1).',
  },
];

/** U2 files (Salesforce connection and change sets) */
const U2_FILES = ['src/salesforce/**/*.{ts,tsx}', 'src/changeset/**/*.{ts,tsx}'];
const U2_CONNECTION_FILE = 'src/salesforce/connection.ts';

/** Rules for U2 files. connection.ts only swaps the globals list */
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

/** U4 files (the add-assist widget and its lazily loaded entry) */
const U4_FILES = ['src/changeset-add-assist/**/*.{ts,tsx}', 'entrypoints/changeset-add-assist.ts'];
/** The only U4 file allowed to call addComponent (U4 NFR3.3) */
const U4_STATE_FILE = 'src/changeset-add-assist/state.ts';

/** Do not import U2's add function outside state.ts (U4 NFR3.3) */
const ADD_COMPONENT_IMPORT = {
  patterns: [
    {
      regex: '(^|/)(salesforce(/index)?|changeset/add-component)$',
      importNames: ['addComponent'],
      message: 'addComponent is used only by runAdd in src/changeset-add-assist/state.ts (NFR3.3).',
    },
  ],
};

/** Rules for U4 files. Only state.ts lifts the addComponent import ban */
function u4Rules({ restrictAddComponent }) {
  return {
    'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...STORAGE_GLOBALS],
    'no-restricted-properties': [
      'error',
      ...BASE_RESTRICTED_PROPERTIES,
      ...NETWORK_PROPERTIES,
      ...STORAGE_PROPERTIES,
    ],
    'no-restricted-imports': restrictAddComponent ? ['error', ADD_COMPONENT_IMPORT] : 'off',
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
      // Never run external code or strings as code (NFR3.2)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // Never treat strings as HTML (NFR3.3)
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
  // U3 files (change set contents viewer). Spread the U1/U2 lists so no ban is lost (U3 cicd-pipeline.md stage 2)
  {
    files: ['src/changeset-viewer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...STORAGE_GLOBALS],
      'no-restricted-properties': [
        'error',
        ...BASE_RESTRICTED_PROPERTIES,
        ...NETWORK_PROPERTIES,
        ...STORAGE_PROPERTIES,
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name="onMessageExternal"]',
          message: 'Messages from outside the extension are not accepted (U3 NFR3.3).',
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
  // U4 (change set add assistant). Placed after U1's src/** and entrypoints/** block,
  // spreading the U1/U2 ban constants together (U4 cicd-pipeline.md stage 2, "avoid overriding")
  {
    files: U4_FILES,
    rules: u4Rules({ restrictAddComponent: true }),
  },
  {
    files: [U4_STATE_FILE],
    rules: u4Rules({ restrictAddComponent: false }),
  },
);
