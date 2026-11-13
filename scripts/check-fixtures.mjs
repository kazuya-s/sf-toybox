// テストの HTML の例に、組織のデータが入っていないことを確かめる（U2 cicd-pipeline.md「テストの HTML の例」）。
// 使い方: node scripts/check-fixtures.mjs [--dir tests/u2/fixtures]
// CI では段階 4（テスト）の前に流す。足すときの手順は tests/u2/fixtures/README.md。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 使ってよい唯一の Salesforce のホスト名 */
export const ALLOWED_HOST = 'example.my.salesforce.com';

const SALESFORCE_HOST_PATTERN = /\b(?:[a-z0-9-]+\.)+(?:salesforce-setup|salesforce|force)\.com\b/gi;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const ID_CANDIDATE_PATTERN = /\b[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?\b/g;
/** 架空の ID: 先頭 3 文字（種類を表す部分）のあとが 0 の並び */
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

/** 15 文字か 18 文字の英数字で、数字を含み、0 の並びでないもの */
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
 * 1 つの HTML の例を確かめ、見つかった問題の一覧を返す。
 * 値そのものは出さず、種類と件数だけを書く（組織のデータをログに残さないため）。
 * @param {string} name @param {string} text
 * @returns {string[]}
 */
export function checkFixtureText(name, text) {
  const checks = [
    [findHosts(text), `${ALLOWED_HOST} 以外の Salesforce のホスト名があります`],
    [[...text.matchAll(EMAIL_PATTERN)], 'メールアドレスがあります'],
    [findRealIds(text), '0 の並びでない 15 文字か 18 文字の ID があります'],
    [[...text.matchAll(LONG_TOKEN_PATTERN)], '32 文字以上の英数字の並びがあります'],
    [findHiddenValues(text), 'test- で始まらない隠し項目の値があります'],
  ];
  return checks
    .filter(([found]) => found.length > 0)
    .map(([found, problem]) => `${name}: ${problem}（${found.length} 件）`);
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
 * フォルダの中の HTML の例をすべて確かめる。
 * @param {{ dir: string }} options
 * @returns {{ errors: string[], checked: number }}
 */
export function checkFixtures({ dir }) {
  if (!existsSync(dir)) return { errors: [`${dir} がありません`], checked: 0 };
  const files = listHtmlFiles(dir);
  const errors = files.flatMap((path) =>
    checkFixtureText(relative(dir, path), readFileSync(path, 'utf8')),
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
  if (errors.length > 0) {
    console.error('テストの HTML の例の確認: 失敗');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`テストの HTML の例の確認: ${checked} 件すべて通りました`);
}
