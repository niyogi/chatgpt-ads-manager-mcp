import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest, requireIdempotencyKey } from "../lib/ads-client.js";

export function registerCampaignTools(server: McpServer) {
  server.tool(
    "list_campaigns",
    "List campaigns for the ad account. Paginated. Use returned campaign_id with get_campaign, update_campaign, create_ad_group, and insights tools. Filter by name if needed.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override. Uses OPENAI_AD_ACCOUNT_ID env if not set."),
      name: z.string().min(3).max(1000).optional().describe("Filter by campaign name (partial, min 3 chars)."),
      limit: z.number().int().min(1).max(500).optional().describe("Max results 1–500."),
      after: z.string().optional().describe("Cursor for forward pagination."),
      before: z.string().optional().describe("Cursor for backward pagination."),
      order: z.enum(["asc", "desc"]).optional().describe("Sort order."),
      include: z.array(z.enum(["serving_issues"])).optional().describe("Optional includes, e.g., serving_issues."),
    },
    async ({ ad_account_id, name, limit, after, before, order, include }) => {
      const query: Record<string, string | string[] | undefined> = {};
      if (name) query.name = name;
      if (limit) query.limit = String(limit);
      if (after) query.after = after;
      if (before) query.before = before;
      if (order) query.order = order;
      if (include) query.include = include;
      const data = await adsRequest({ method: "GET", path: "/campaigns", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_campaign",
    "Get a single campaign by ID. Use include=[serving_issues] to audit delivery problems. Returned id chains to ad group creation.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      campaign_id: z.string().min(1).describe("Campaign ID (e.g., cmpn_...)"),
      include: z.array(z.enum(["serving_issues"])).optional().describe("Optional includes."),
    },
    async ({ ad_account_id, campaign_id, include }) => {
      const query: Record<string, string | string[] | undefined> = {};
      if (include) query.include = include;
      const data = await adsRequest({
        method: "GET",
        path: `/campaigns/${encodeURIComponent(campaign_id)}`,
        query,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_campaign",
    "Create a campaign. Returns campaign_id for chaining to create_ad_group. Common next: create_ad_group with campaign_id. Supports idempotency key to avoid duplicates on retry.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      idempotency_key: z.string().min(1).max(255).optional().describe("Idempotency key 1–255 chars. Auto-generated if omitted."),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).describe("Campaign name 3–1000 chars."),
      status: z.enum(["active", "paused"]).optional().describe("Initial status (default per API). Use activate/pause tools after."),
      budget: z
        .object({
          lifetime_spend_limit_micros: z.number().int().min(1_000_000).optional(),
          daily_spend_limit_micros: z.number().int().min(1_000_000).optional(),
        })
        .optional()
        .describe("Budget caps in micros (1 USD = 1,000,000)."),
      description: z.string().optional().describe("Optional description."),
      start_time: z.number().int().optional().describe("Start unix seconds (946684800–4102444800)."),
      end_time: z.number().int().optional().describe("End unix seconds."),
      bidding_type: z.enum(["impressions", "clicks", "conversions"]).optional().describe("Bidding type. Use conversions with conversion_event_setting_ids."),
      objective: z.enum(["reach", "clicks", "conversions"]).optional().describe("Campaign objective."),
      billing_event_type: z.enum(["impression", "click"]).optional().describe("Billing event."),
      mode: z.enum(["product_feed", "business_agent"]).optional().describe("Mode for catalog or business agent campaigns."),
      product_feed_id: z.string().optional().describe("Product feed ID if mode=product_feed."),
      business_agent_id: z.string().optional().describe("Business agent ID if mode=business_agent."),
      targeting: z
        .object({
          locations: z
            .object({
              include: z
                .array(
                  z.object({
                    id: z.string(),
                    name: z.string().optional(),
                    type: z.string().optional(),
                    country_code: z.string().optional(),
                    region_code: z.string().optional(),
                  })
                )
                .optional(),
              countries: z.array(z.string()).optional(),
            })
            .optional(),
          excluded_locations: z
            .object({
              include: z.array(z.object({ id: z.string() })).optional(),
            })
            .optional(),
          custom_audiences: z.object({ ids: z.array(z.string()) }).optional(),
          excluded_custom_audiences: z.object({ ids: z.array(z.string()) }).optional(),
          platforms: z.object({ included: z.array(z.string()) }).optional(),
        })
        .optional()
        .describe("Targeting object (locations, audiences, platforms). Use search_geo_lookup to resolve location IDs first."),
      landing_page_configuration: z.object({ query_string_template: z.string().optional() }).optional(),
      conversion_event_setting_ids: z.array(z.string()).optional().describe("Conversion event setting IDs (exactly 1 when bidding_type=conversions)."),
    },
    async ({ ad_account_id, idempotency_key, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      const data = await adsRequest({
        method: "POST",
        path: "/campaigns",
        body: clean,
        adAccountId: ad_account_id,
        idempotencyKey: idempotency_key?.trim() || undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_campaign",
    "Update a campaign by ID. Only provided fields are updated. Omitted optional fields reset to defaults except where noted. Send null to clear description/start_time/end_time.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      campaign_id: z.string().min(1).describe("Campaign ID."),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).optional(),
      status: z.enum(["active", "paused", "archived"]).optional(),
      budget: z
        .object({
          lifetime_spend_limit_micros: z.number().int().min(1_000_000).nullable().optional(),
          daily_spend_limit_micros: z.number().int().min(1_000_000).nullable().optional(),
        })
        .optional(),
      description: z.string().nullable().optional(),
      start_time: z.number().int().nullable().optional(),
      end_time: z.number().int().nullable().optional(),
      bidding_type: z.enum(["impressions", "clicks", "conversions"]).optional(),
      objective: z.enum(["reach", "clicks", "conversions"]).optional(),
      billing_event_type: z.enum(["impression", "click"]).optional(),
      targeting: z.record(z.unknown()).optional(),
      landing_page_configuration: z.record(z.unknown()).optional(),
      conversion_event_setting_ids: z.array(z.string()).optional(),
    },
    async ({ ad_account_id, campaign_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      const data = await adsRequest({
        method: "POST",
        path: `/campaigns/${encodeURIComponent(campaign_id)}`,
        body: clean,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "activate_campaign",
    "Activate a paused campaign. All ancestors must be active for ads to serve.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      campaign_id: z.string().min(1).describe("Campaign ID."),
    },
    async ({ ad_account_id, campaign_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/campaigns/${encodeURIComponent(campaign_id)}/activate`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "pause_campaign",
    "Pause an active campaign. Reversible via activate_campaign.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      campaign_id: z.string().min(1).describe("Campaign ID."),
    },
    async ({ ad_account_id, campaign_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/campaigns/${encodeURIComponent(campaign_id)}/pause`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "archive_campaign",
    "Archive a campaign (terminal — cannot be reactivated via activate).",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      campaign_id: z.string().min(1).describe("Campaign ID."),
    },
    async ({ ad_account_id, campaign_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/campaigns/${encodeURIComponent(campaign_id)}/archive`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
