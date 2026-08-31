import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest } from "../lib/ads-client.js";

export function registerAdAccountTools(server: McpServer) {
  server.tool(
    "get_ad_account",
    "Get metadata for the ad account associated with the API key. Use to verify auth, check timezone/currency/review status. No chaining needed — call first to confirm key works.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override. Uses OPENAI_AD_ACCOUNT_ID env if not set."),
    },
    async ({ ad_account_id }) => {
      const data = await adsRequest({ method: "GET", path: "/ad_account", adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_ad_accounts",
    "List ad accounts accessible to the authenticated key/OAuth token. Returns accounts with ids for use as ad_account_id in other tools.",
    {
      ad_account_id: z.string().optional().describe("Optional header override — rarely needed for this endpoint."),
    },
    async ({ ad_account_id }) => {
      const data = await adsRequest({ method: "GET", path: "/ad_accounts", adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_ad_account_brand",
    "Update ad account brand metadata (name, url, etc.). Requires account be enabled for programmatic brand updates or it will 403. Chain after get_ad_account to see current values.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      name: z.string().min(1).max(1000).optional().describe("Brand display name."),
      url: z.string().url().optional().describe("Brand website URL (https)."),
      preview_url: z.string().url().nullable().optional().describe("Preview URL or null."),
    },
    async ({ ad_account_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      const data = await adsRequest({ method: "POST", path: "/ad_account/brand", body: clean, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_ad_account_negative_keywords",
    "Replace account-level negative keywords used for ad eligibility. Provide full desired list — this is a replace, not append. Use to block unwanted contexts.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      negative_keywords: z.array(z.string().min(1)).describe("Full list of negative keywords to set (replaces existing). Empty array clears."),
    },
    async ({ ad_account_id, negative_keywords }) => {
      const data = await adsRequest({
        method: "POST",
        path: "/ad_account/negative_keywords",
        body: { negative_keywords },
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "activate_ad_account",
    "Activate the ad account (resume serving). All parent campaigns/ad groups/ads must also be active to serve.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
    },
    async ({ ad_account_id }) => {
      const data = await adsRequest({ method: "POST", path: "/ad_account/activate", adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "pause_ad_account",
    "Pause the ad account (stop all serving). Reversible via activate_ad_account.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
    },
    async ({ ad_account_id }) => {
      const data = await adsRequest({ method: "POST", path: "/ad_account/pause", adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_ad_account_spend_limit_windows",
    "View spend limit windows (inclusive start, exclusive end, ordered by start ascending). Use to audit or plan budget caps.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
    },
    async ({ ad_account_id }) => {
      const data = await adsRequest({ method: "GET", path: "/ad_account/spend_limit_windows", adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_ad_account_spend_limit_window",
    "Create a spend limit window with inclusive start and exclusive end. Use to cap spend over a date range.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      start_time: z.number().int().describe("Inclusive start as unix seconds."),
      end_time: z.number().int().describe("Exclusive end as unix seconds."),
      spend_limit_micros: z.number().int().min(1).describe("Spend cap in micros (1 USD = 1,000,000)."),
    },
    async ({ ad_account_id, start_time, end_time, spend_limit_micros }) => {
      const data = await adsRequest({
        method: "POST",
        path: "/ad_account/spend_limit_windows",
        body: { start_time, end_time, spend_limit_micros },
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_ad_account_spend_limit_window",
    "Edit a spend limit window (inclusive start, exclusive end). Provide window_id from get/create.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      window_id: z.string().min(1).describe("Spend limit window ID."),
      start_time: z.number().int().optional().describe("Inclusive start unix seconds."),
      end_time: z.number().int().optional().describe("Exclusive end unix seconds."),
      spend_limit_micros: z.number().int().min(1).optional().describe("Spend cap in micros."),
    },
    async ({ ad_account_id, window_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      const data = await adsRequest({
        method: "POST",
        path: `/ad_account/spend_limit_windows/${encodeURIComponent(window_id)}`,
        body: clean,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_ad_account_spend_limit_window",
    "Delete an active or scheduled spend limit window before it ends.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      window_id: z.string().min(1).describe("Spend limit window ID."),
    },
    async ({ ad_account_id, window_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/ad_account/spend_limit_windows/${encodeURIComponent(window_id)}/delete`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_oauth_me",
    "Return the authenticated user's stable opaque ID (OAuth only). Useful for partner flows to verify token identity.",
    {},
    async () => {
      const data = await adsRequest({ method: "GET", path: "/me" });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_api_key",
    "Create an API key scoped to the selected ad account (requires AdsOAuth with write or an existing API key with permission). Returns the new key — store it securely, it won't be shown again.",
    {
      ad_account_id: z.string().optional().describe("Ad account to scope the new key to. Falls back to env."),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).optional().describe("Human-readable key name."),
    },
    async ({ ad_account_id, name }) => {
      const body: Record<string, unknown> = {};
      if (name) body.name = name;
      // POST /api_keys historically takes ad_account selection via header; body may contain ad_account_id in some impls
      const data = await adsRequest({ method: "POST", path: "/api_keys", body, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
