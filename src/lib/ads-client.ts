import { getApiKey, getBaseUrl, resolveAdAccountId } from "../config.js";
import { requireApiKey } from "../config.js";

export type AdsRequestOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: URLSearchParams | Record<string, string | string[] | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  adAccountId?: string;
  idempotencyKey?: string;
  /** For multipart uploads — if set, body is FormData and Content-Type is auto */
  formData?: FormData;
};

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "authorization") out[k] = "***redacted***";
    else out[k] = v;
  }
  return out;
}

function buildUrl(base: string, path: string, query?: AdsRequestOptions["query"]): string {
  const url = new URL(`${base}${path}`);
  if (!query) return url.toString();
  if (query instanceof URLSearchParams) {
    query.forEach((v, k) => url.searchParams.append(k, v));
    return url.toString();
  }
  for (const [k, v] of Object.entries(query)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item != null) url.searchParams.append(k, String(item));
    } else {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export function getAuthHeaders(adAccountId?: string, extra?: Record<string, string>, idempotencyKey?: string): Record<string, string> {
  const apiKey = requireApiKey();
  const resolvedAccount = resolveAdAccountId(adAccountId);
  const h: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (resolvedAccount) h["OpenAI-Ad-Account"] = resolvedAccount;
  if (idempotencyKey) h["Idempotency-Key"] = idempotencyKey;
  if (extra) Object.assign(h, extra);
  return h;
}

export async function adsRequest<T = unknown>(opts: AdsRequestOptions): Promise<T> {
  const base = getBaseUrl();
  const url = buildUrl(base, opts.path, opts.query);
  const headers = getAuthHeaders(opts.adAccountId, opts.headers, opts.idempotencyKey);

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData as unknown as BodyInit;
    // Let fetch set multipart boundary — delete any manual Content-Type
    delete (headers as Record<string, string>)["Content-Type"];
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    body = JSON.stringify(opts.body);
  }

  // Basic SSRF sanity: base must be ads.openai.com or localhost for tests
  try {
    const u = new URL(url);
    const host = u.hostname;
    // Allow only official hosts plus localhost for tests
    const allowed = host === "api.ads.openai.com" || host === "localhost" || host === "127.0.0.1";
    // If user overrides base URL, still block private CIDRs at request level via validateExternalUrl if needed.
    // Here we just ensure scheme is https unless localhost.
    if (!allowed) {
      // For custom base URLs, still require https
      if (u.protocol !== "https:" && host !== "localhost" && host !== "127.0.0.1") {
        throw new Error(`Base URL must use https: (got ${u.protocol})`);
      }
    }
  } catch (e) {
    throw e;
  }

  const res = await fetch(url, {
    method: opts.method,
    headers,
    body,
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!res.ok) {
    // Redact auth from error message; surface useful API error
    const detail =
      typeof json === "object" && json !== null && "error" in (json as Record<string, unknown>)
        ? JSON.stringify(json)
        : text.slice(0, 2000);
    const retryAfter = res.headers.get("Retry-After");
    const hint =
      res.status === 429
        ? ` Rate limited. ${retryAfter ? `Retry-After: ${retryAfter}s.` : "Back off and retry."}`
        : res.status === 401
          ? " Check your OPENAI_ADS_API_KEY is correct and not expired. Issue a new key at https://ads.openai.com > Settings."
          : res.status === 403
            ? " Your ad account may not be enabled for this operation (e.g., conversions, brand updates). Contact your OpenAI partner representative."
            : "";
    const msg = `Ads API ${opts.method} ${opts.path} failed: ${res.status} ${res.statusText}. ${detail}${hint}`;
    // Never include Authorization header value in thrown error
    void redactHeaders(headers);
    const err = new Error(msg) as Error & { status?: number; retryAfter?: string | null; body?: unknown };
    err.status = res.status;
    err.retryAfter = retryAfter;
    err.body = json;
    throw err;
  }

  return json as T;
}

export function autoIdempotencyKey(provided?: string): string | undefined {
  if (provided?.trim()) return provided.trim();
  // Callers that require a key should auto-generate; callers where it's optional return undefined
  return undefined;
}

export function requireIdempotencyKey(provided?: string): string {
  const k = provided?.trim();
  if (k) return k;
  // Node 14+ has crypto.randomUUID
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return uuid;
}
