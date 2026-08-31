import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest } from "../lib/ads-client.js";

export function registerConversionTools(server: McpServer) {
  server.tool(
    "create_conversion_pixel",
    "Create a conversion pixel (client data source) for the ad account. Returns pixel id (pid) used for event attribution and listing sampled events. Chain to create_conversion_api_key and create_conversion_event_setting.",
    {
      ad_account_id: z.string().optional(),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).describe("Pixel name 3–1000 chars."),
      client_type: z.enum(["web"]).optional().describe("Client type (currently only web)."),
    },
    async ({ ad_account_id, name, client_type }) => {
      const body: Record<string, unknown> = { name };
      if (client_type) body.client_type = client_type;
      const data = await adsRequest({ method: "POST", path: "/conversions/pixels", body, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_conversion_pixels",
    "List conversion pixels and connected pixel IDs for the ad account. Use pid from here with list_conversion_events.",
    {
      ad_account_id: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
      after: z.string().optional(),
      before: z.string().optional(),
      order: z.enum(["asc", "desc"]).optional(),
    },
    async ({ ad_account_id, limit, after, before, order }) => {
      const query: Record<string, string | undefined> = {};
      if (limit) query.limit = String(limit);
      if (after) query.after = after;
      if (before) query.before = before;
      if (order) query.order = order;
      const data = await adsRequest({ method: "GET", path: "/conversions/pixels", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_conversion_api_key",
    "Create a Conversions API key for the ad account (used to send server-side events via bzr.openai.com outside this MCP). Returns api_key — store securely, single display.",
    {
      ad_account_id: z.string().optional(),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).describe("Key name 3–1000 chars."),
    },
    async ({ ad_account_id, name }) => {
      const data = await adsRequest({
        method: "POST",
        path: "/conversions/api_keys",
        body: { name },
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_conversion_event_setting",
    "Create a conversion event setting linking an event type to source pixel(s). Used for conversions bidding (bidding_type=conversions) and conversion_event_setting_ids on campaigns. Requires name + event_type + source_ids.",
    {
      ad_account_id: z.string().optional(),
      name: z.string().min(1).describe("Event setting name."),
      event_type: z.string().min(1).describe("Event type e.g., order_created, page_viewed, custom, app_installed."),
      custom_event_name: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/).optional().describe("Required if event_type=custom: 1–64 lower [a-z0-9_-]."),
      attribution_window_days: z.number().int().min(1).optional().describe("Click attribution window days. View-through fixed 1 day."),
      source_ids: z.array(z.string().min(1)).min(1).describe("Pixel/source IDs (at least 1). Use pid from create_conversion_pixel."),
    },
    async ({ ad_account_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      const data = await adsRequest({
        method: "POST",
        path: "/conversions/event_settings",
        body: clean,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_conversion_event_settings",
    "List conversion event settings for the ad account. Use IDs with campaign conversion_event_setting_ids and conversions bidding.",
    {
      ad_account_id: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
      after: z.string().optional(),
      before: z.string().optional(),
      order: z.enum(["asc", "desc"]).optional(),
    },
    async ({ ad_account_id, limit, after, before, order }) => {
      const query: Record<string, string | undefined> = {};
      if (limit) query.limit = String(limit);
      if (after) query.after = after;
      if (before) query.before = before;
      if (order) query.order = order;
      const data = await adsRequest({ method: "GET", path: "/conversions/event_settings", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_conversion_events",
    "List recent sampled conversion events for a pixel (requires pid). Up to 50 per call. Use to verify ingestion from bzr.openai.com.",
    {
      ad_account_id: z.string().optional(),
      pid: z.string().min(1).describe("Pixel ID (pid) from list_conversion_pixels."),
      limit: z.number().int().min(1).max(50).optional().describe("Max 1–50."),
    },
    async ({ ad_account_id, pid, limit }) => {
      const query: Record<string, string | undefined> = { pid };
      if (limit) query.limit = String(limit);
      const data = await adsRequest({ method: "GET", path: "/conversions/events", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
