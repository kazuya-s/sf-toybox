/**
 * Helpers to verify that ESLint rules are in effect.
 * Uses the repository's eslint.config.js as is and lints code strings as if they were at a given file path.
 */
import { ESLint } from 'eslint';

let eslint: ESLint | null = null;

function getEslint(): ESLint {
  eslint ??= new ESLint({ cwd: process.cwd() });
  return eslint;
}

/** Lints code as the file at filePath and returns the names of rules that reported errors */
export async function lintRuleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await getEslint().lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.severity === 2)
    .map((message) => message.ruleId ?? 'fatal');
}
