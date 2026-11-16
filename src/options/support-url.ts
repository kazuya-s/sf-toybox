/**
 * Support URL (GitHub Issues) (BR1.8, AC1.1.6).
 * Read from bugs.url in package.json. It stays empty until the repository exists; meanwhile the options page
 * shows "Repository coming soon" instead of a link (code-generation-plan.md, "Questions for the author").
 */
import { bugs } from '../../package.json';

/** Only https URLs are used. Empty or malformed values become null (not configured) */
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
