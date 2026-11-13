/**
 * ESLint の規則が効いていることを確かめるための道具。
 * リポジトリの eslint.config.js をそのまま使い、文字列のコードを決めたファイルの場所として検査する。
 */
import { ESLint } from 'eslint';

let eslint: ESLint | null = null;

function getEslint(): ESLint {
  eslint ??= new ESLint({ cwd: process.cwd() });
  return eslint;
}

/** code を filePath のファイルとして検査し、エラーになった規則の名前を返す */
export async function lintRuleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await getEslint().lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.severity === 2)
    .map((message) => message.ruleId ?? 'fatal');
}
