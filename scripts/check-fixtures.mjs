// Checks that the test HTML fixtures contain no org data (U2 cicd-pipeline.md, "Test HTML fixtures").
// U3 added the check for JSON test data in tests/u3/fixtures/ and tests/u4/fixtures/ (U3 cicd-pipeline.md, "Test data").
// Usage: node scripts/check-fixtures.mjs [--dir tests/u2/fixtures]
// CI runs it before stage 4 (tests). See tests/u2/fixtures/README.md for how to add fixtures.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The only Salesforce host name allowed */
export const ALLOWED_HOST = 'example.my.salesforce.com';

const SALESFORCE_HOST_PATTERN = /\b(?:[a-z0-9-]+\.)+(?:salesforce-setup|salesforce|force)\.com\b/gi;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const ID_CANDIDATE_PATTERN = /\b[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?\b/g;
/** Fake IDs: all zeros after the 3-character key prefix */
const FAKE_ID_PATTERN = /^[A-Za-z0-9]{3}0{9}/;
const LONG_TOKEN_PATTERN = /[A-Za-z0-9]{32,}/g;
const INPUT_TAG_PATTERN = /<input\b[^>]*>/gi;

/** @param {string} tag @param {string} name */
function attributeOf(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? '';
}

/** @param {string} text */
function findHosts(text) {
  return [...text.matchAll(SALESFORCE_HOST_PATTERN)]
    .map((match) => match[0])
    .filter((host) => host.toLowerCase() !== ALLOWED_HOST);
}

/** 15- or 18-character alphanumeric strings that contain a digit and are not all zeros */
function findRealIds(text) {
  return [...text.matchAll(ID_CANDIDATE_PATTERN)]
    .map((match) => match[0])
    .filter((id) => /\d/.test(id) && !FAKE_ID_PATTERN.test(id));
}

/** @param {string} text */
function findHiddenValues(text) {
  return [...text.matchAll(INPUT_TAG_PATTERN)]
    .map((match) => match[0])
    .filter((tag) => (attributeOf(tag, 'type') ?? '').toLowerCase() === 'hidden')
    .map((tag) => attributeOf(tag, 'value'))
    .filter((value) => value !== null && !value.startsWith('test-'));
}

/**
 * Checks one HTML fixture and returns the problems found.
 * Reports only the kind and count, never the values themselves (so no org data reaches the logs).
 * @param {string} name @param {string} text
 * @returns {string[]}
 */
export function checkFixtureText(name, text) {
  const checks = [
    [findHosts(text), `has a Salesforce host name other than ${ALLOWED_HOST}`],
    [[...text.matchAll(EMAIL_PATTERN)], 'has an email address'],
    [findRealIds(text), 'has a 15- or 18-character ID that is not all zeros'],
    [[...text.matchAll(LONG_TOKEN_PATTERN)], 'has an alphanumeric run of 32 or more characters'],
    [findHiddenValues(text), 'has a hidden field value that does not start with test-'],
  ];
  return checks
    .filter(([found]) => found.length > 0)
    .map(([found, problem]) => `${name}: ${problem} (${found.length})`);
}

/** @param {string} dir @returns {string[]} */
function listHtmlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listHtmlFiles(path);
    return /\.html?$/i.test(entry) ? [path] : [];
  });
}

/**
 * Checks every HTML fixture in a folder.
 * @param {{ dir: string }} options
 * @returns {{ errors: string[], checked: number }}
 */
export function checkFixtures({ dir }) {
  if (!existsSync(dir)) return { errors: [`${dir} does not exist`], checked: 0 };
  const files = listHtmlFiles(dir);
  const errors = files.flatMap((path) =>
    checkFixtureText(relative(dir, path), readFileSync(path, 'utf8')),
  );
  return { errors, checked: files.length };
}

// ---- JSON test data (U3 cicd-pipeline.md, "Test data") ----

/** Folders holding JSON test data (used by U3 and U4; missing folders are skipped) */
export const JSON_FIXTURE_DIRS = ['tests/u3/fixtures', 'tests/u4/fixtures'];

/** Name fields whose values must start with Test (null excluded) */
const NAME_FIELDS = ['name', 'apiName', 'parentObject'];

/**
 * Collects the JSON values (not the keys) as strings, together with the name of their field.
 * Values inside an array inherit the array field's name.
 * @param {unknown} value @param {string | null} key @param {{ key: string | null, text: string }[]} out
 */
function collectStrings(value, key, out) {
  if (typeof value === 'string') out.push({ key, text: value });
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, key, out));
  else if (value !== null && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) collectStrings(child, childKey, out);
  }
}

/** @param {{ key: string | null, text: string }[]} values @param {(text: string) => unknown[]} find */
function countAll(values, find) {
  return values.flatMap((value) => find(value.text));
}

/**
 * Checks one JSON test data file and returns the problems found.
 * Reports only the kind and count, never the values themselves.
 * @param {string} name @param {string} text
 * @returns {string[]}
 */
export function checkJsonFixtureText(name, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [`${name}: cannot be parsed as JSON`];
  }
  /** @type {{ key: string | null, text: string }[]} */
  const values = [];
  collectStrings(data, null, values);
  const badNames = values.filter(
    (value) =>
      value.key !== null && NAME_FIELDS.includes(value.key) && !value.text.startsWith('Test'),
  );
  const checks = [
    [countAll(values, findHosts), `has a Salesforce host name other than ${ALLOWED_HOST}`],
    [countAll(values, (t) => [...t.matchAll(EMAIL_PATTERN)]), 'has an email address'],
    [countAll(values, findRealIds), 'has a 15- or 18-character ID that is not all zeros'],
    [
      countAll(values, (t) => [...t.matchAll(LONG_TOKEN_PATTERN)]),
      'has an alphanumeric run of 32 or more characters',
    ],
    [badNames, `has a value not starting with Test in a name field (${NAME_FIELDS.join(', ')})`],
  ];
  return checks
    .filter(([found]) => found.length > 0)
    .map(([found, problem]) => `${name}: ${problem} (${found.length})`);
}

/** @param {string} dir @returns {string[]} */
function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listJsonFiles(path);
    return /\.json$/i.test(entry) ? [path] : [];
  });
}

/**
 * Checks every JSON test data file in several folders. Missing folders are skipped.
 * @param {{ dirs: string[] }} options
 * @returns {{ errors: string[], checked: number }}
 */
export function checkJsonFixtures({ dirs }) {
  const files = dirs.flatMap((dir) => listJsonFiles(dir).map((path) => ({ dir, path })));
  const errors = files.flatMap(({ dir, path }) =>
    checkJsonFixtureText(relative(dir, path), readFileSync(path, 'utf8')),
  );
  return { errors, checked: files.length };
}

/** @param {string[]} argv */
function parseArgs(argv) {
  let dir = 'tests/u2/fixtures';
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--dir') dir = argv[++index] ?? dir;
  }
  return { dir: resolve(dir) };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const { errors, checked } = checkFixtures(parseArgs(process.argv.slice(2)));
  const json = checkJsonFixtures({ dirs: JSON_FIXTURE_DIRS.map((dir) => resolve(dir)) });
  if (errors.length > 0) {
    console.error('Test HTML fixture check: failed');
    for (const error of errors) console.error(`  - ${error}`);
  } else {
    console.log(`Test HTML fixture check: all ${checked} passed`);
  }
  if (json.errors.length > 0) {
    console.error('Test JSON data check: failed');
    for (const error of json.errors) console.error(`  - ${error}`);
  } else {
    console.log(`Test JSON data check: all ${json.checked} passed`);
  }
  if (errors.length > 0 || json.errors.length > 0) process.exit(1);
}
