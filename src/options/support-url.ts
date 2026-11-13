/**
 * 問い合わせ先（GitHub の Issue）の URL（BR1.8、AC1.1.6）。
 * package.json の bugs.url から読む。リポジトリが決まるまでは空のままで、そのあいだ設定画面は
 * リンクの代わりに「リポジトリの準備中」を出す（code-generation-plan.md「作者に確かめたいこと」）。
 */
import { bugs } from '../../package.json';

/** https の URL だけを使う。空や形の正しくない値は null（未設定） */
export function resolveSupportUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export const SUPPORT_URL = resolveSupportUrl(bugs?.url);
