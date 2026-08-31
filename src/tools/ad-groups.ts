import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest } from "../lib/ads-client.js";

export function registerAdGroupTools(server: McpServer) {
  server.tool(
    "list_ad_groups",
    "List ad groups for the ad account, optionally filtered by campaign_id. Use returned ad_group_id to create ads or fetch insights.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      campaign_id: z.string().optional().describe("Filter by campaign ID."),
      name: z.string().min(3).max(1000).optional().describe("Filter by name (min 3 chars)."),
      limit: z.number().int().min(1).max(500).optional(),
      after: z.string().optional(),
      before: z.string().optional(),
      order: z.enum(["asc", "desc"]).optional(),
      include: z.array(z.string()).optional().describe("Optional includes."),
    },
    async ({ ad_account_id, campaign_id, name, limit, after, before, order, include }) => {
      const query: Record<string, string | string[] | undefined> = {};
      if (campaign_id) query.campaign_id = campaign_id;
      if (name) query.name = name;
      if (limit) query.limit = String(limit);
      if (after) query.after = after;
      if (before) query.before = before;
      if (order) query.order = order;
      if (include) query.include = include;
      const data = await adsRequest({ method: "GET", path: "/ad_groups", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_ad_group",
    "Get a single ad group by ID.",
    {
      ad_account_id: z.string().optional(),
      ad_group_id: z.string().min(1).describe("Ad group ID."),
      include: z.array(z.string()).optional(),
    },
    async ({ ad_account_id, ad_group_id, include }) => {
      const query: Record<string, string | string[] | undefined> = {};
      if (include) query.include = include;
      const data = await adsRequest({
        method: "GET",
        path: `/ad_groups/${encodeURIComponent(ad_group_id)}`,
        query,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_ad_group",
    "Create an ad group for a campaign. Returns ad_group_id for chaining to create_ad. Requires campaign_id + bidding_config.",
    {
      ad_account_id: z.string().optional(),
      idempotency_key: z.string().min(1).max(255).optional(),
      campaign_id: z.string().min(1).describe("Parent campaign ID."),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).describe("Ad group name."),
      status: z.enum(["active", "paused"]).optional(),
      description: z.string().optional(),
      context_hints: z.array(z.string()).optional().describe("Context hints up to 2000 chars each."),
      bidding_config: z
        .object({
          billing_event_type: z.enum(["impression", "click"]).describe("Required billing event."),
          strategy: z.string().optional(),
          max_bid_micros: z.number().int().min(1).max(30400000000000).optional(),
          custom_audience_bid_multipliers: z
            .array(
              z.object({
                custom_audience_id: z.string().min(1),
                bid_multiplier_micros: z.number().int().min(100000).max(10000000),
              })
            )
            .optional(),
        })
        .describe("Bidding config (billing_event_type required)."),
      product_set: z
        .object({
          product_feed_id: z.string(),
          filters: z
            .array(
              z.object({
                field: z.string(),
                operator: z.enum(["in", "gt", "gte", "lt", "lte"]),
                values: z.array(z.string()),
              })
            )
            .optional(),
        })
        .optional()
        .describe("Product feed set for feed campaigns."),
      landing_page_configuration: z.object({ query_string_template: z.string().optional() }).optional(),
    },
    async ({ ad_account_id, idempotency_key, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      const data = await adsRequest({
        method: "POST",
        path: "/ad_groups",
        body: clean,
        adAccountId: ad_account_id,
        idempotencyKey: idempotency_key?.trim() || undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_ad_group",
    "Update an ad group by ID.",
    {
      ad_account_id: z.string().optional(),
      ad_group_id: z.string().min(1).describe("Ad group ID."),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).optional(),
      status: z.enum(["active", "paused", "archived"]).optional(),
      description: z.string().nullable().optional(),
      context_hints: z.array(z.string()).nullable().optional(),
      bidding_config: z.record(z.unknown()).optional(),
      product_set: z.record(z.unknown()).nullable().optional(),
      landing_page_configuration: z.record(z.unknown()).optional(),
    },
    async ({ ad_account_id, ad_group_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      const data = await adsRequest({
        method: "POST",
        path: `/ad_groups/${encodeURIComponent(ad_group_id)}`,
        body: clean,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "activate_ad_group",
    "Activate a paused ad group.",
    {
      ad_account_id: z.string().optional(),
      ad_group_id: z.string().min(1).describe("Ad group ID."),
    },
    async ({ ad_account_id, ad_group_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/ad_groups/${encodeURIComponent(ad_group_id)}/activate`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "pause_ad_group",
    "Pause an active ad group.",
    {
      ad_account_id: z.string().optional(),
      ad_group_id: z.string().min(1).describe("Ad group ID."),
    },
    async ({ ad_account_id, ad_group_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/ad_groups/${encodeURIComponent(ad_group_id)}/pause`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "archive_ad_group",
    "Archive an ad group (terminal).",
    {
      ad_account_id: z.string().optional(),
      ad_group_id: z.string().min(1).describe("Ad group ID."),
    },
    async ({ ad_account_id, ad_group_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/ad_groups/${encodeURIComponent(ad_group_id)}/archive`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
