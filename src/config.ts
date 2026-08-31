import { z } from "zod";

const EnvSchema = z.object({
  OPENAI_ADS_API_KEY: z.string().optional(),
  CHATGPT_ADS_API_KEY: z.string().optional(),
  OPENAI_AD_ACCOUNT_ID: z.string().optional(),
  CHATGPT_AD_ACCOUNT_ID: z.string().optional(),
  OPENAI_ADS_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  return EnvSchema.parse(process.env);
}

export function getApiKey(): string | undefined {
  const env = getEnv();
  const raw =
    env.OPENAI_ADS_API_KEY?.trim() || env.CHATGPT_ADS_API_KEY?.trim() || "";
  return raw.length > 0 ? raw : undefined;
}

export function getAdAccountId(): string | undefined {
  const env = getEnv();
  return (
    env.OPENAI_AD_ACCOUNT_ID?.trim() ||
    env.CHATGPT_AD_ACCOUNT_ID?.trim() ||
    undefined
  );
}

export function getBaseUrl(): string {
  const env = getEnv();
  const url = env.OPENAI_ADS_BASE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return "https://api.ads.openai.com/v1";
}

export function requireApiKey(): string {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      "Missing Advertiser API key. Set OPENAI_ADS_API_KEY (or alias CHATGPT_ADS_API_KEY) in your MCP config env. Get a key at https://ads.openai.com > Settings > API Keys. Example for Claude Desktop: {\"mcpServers\":{\"chatgpt-ads-manager\":{\"command\":\"npx\",\"args\":[\"-y\",\"chatgpt-ads-manager-mcp\"],\"env\":{\"OPENAI_ADS_API_KEY\":\"sk-ads-...\"}}}}"
    );
  }
  if (key.length < 8) {
    throw new Error(
      "OPENAI_ADS_API_KEY looks too short — check you pasted the full key."
    );
  }
  return key;
}

export function resolveAdAccountId(explicit?: string): string | undefined {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  return getAdAccountId();
}
