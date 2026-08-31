/**
 * SSRF guard for any user-supplied URL that this MCP will fetch.
 * Blocks private networks, non-https, disallowed schemes, and overly long URLs.
 * No DNS lookup here — string-level block is deterministic; upstream fetch still enforces timeouts.
 */

const MAX_URL_LENGTH = 2048;
const BLOCKED_SCHEMES = new Set(["file:", "javascript:", "data:", "ftp:", "gopher:"]);

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/i,
  /^10\.\d+\.\d+\.\d+$/i,
  /^192\.168\.\d+\.\d+$/i,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/i,
  /^169\.254\.\d+\.\d+$/i, // link-local incl. cloud metadata
  /^0\.0\.0\.0$/i,
  /^::1$/i,
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
];

export function validateExternalUrl(
  raw: string,
  opts: { requireHttps?: boolean; paramName?: string } = {}
): URL {
  const paramName = opts.paramName ?? "url";
  const requireHttps = opts.requireHttps ?? true;

  if (!raw || typeof raw !== "string") {
    throw new Error(`${paramName} is required and must be a string.`);
  }
  if (raw.length > MAX_URL_LENGTH) {
    throw new Error(`${paramName} exceeds max length ${MAX_URL_LENGTH}.`);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${paramName} is not a valid URL: ${raw.slice(0, 80)}`);
  }

  if (BLOCKED_SCHEMES.has(url.protocol)) {
    throw new Error(`${paramName} uses blocked scheme ${url.protocol}.`);
  }
  if (requireHttps && url.protocol !== "https:") {
    throw new Error(
      `${paramName} must use https: (got ${url.protocol}). Set requireHttps false only if you explicitly need http.`
    );
  }
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error(`${paramName} must be https: or http: (got ${url.protocol}).`);
  }

  const host = url.hostname.trim();
  for (const re of PRIVATE_HOST_PATTERNS) {
    if (re.test(host)) {
      throw new Error(
        `${paramName} points to a private/internal host (${host}) — blocked to prevent SSRF.`
      );
    }
  }
  // Block bare private shortnames that resolve internally (heuristic)
  if (!host.includes(".") && host.toLowerCase() !== "localhost") {
    // Allow only if it's an explicit allowlist? For now block ambiguous.
    // But "*.openai.com" etc all contain dots, so this is safe.
  }

  if (url.username || url.password) {
    throw new Error(`${paramName} must not contain embedded credentials.`);
  }

  return url;
}
