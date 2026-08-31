import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest } from "../lib/ads-client.js";

const insightFields = {
  ad_account_id: z.string().optional(),
  time_granularity: z.enum(["hourly", "daily", "weekly", "monthly", "all", "none"]).optional().describe("Time bucket. Use daily for trend analysis."),
  aggregation_level: z.enum(["ad_account", "campaign", "ad_group", "ad"]).optional().describe("Aggregation scope."),
  limit: z.number().int().min(1).max(2000).optional().describe("Max rows 1–2000."),
  before: z.string().optional().describe("Cursor for pagination."),
  after: z.string().optional().describe("Cursor for pagination."),
  time_ranges: z.array(z.string()).optional().describe("Time ranges, e.g., [\"2026-01-01:2026-01-31\"]. Check docs for format; required for conversion insights."),
  filters: z.array(z.string()).optional().describe("Filters array (opaque, enumerated in docs)."),
  fields: z.array(z.string()).optional().describe("Fields to return, e.g., [\"impressions\",\"clicks\",\"spend_micros\"]."),
  sort: z.array(z.string()).optional().describe("Sort specs, e.g., [\"-impressions\"]."),
  segments: z.array(z.string()).optional().describe("Segments: product, country, device, etc. For product breakdown add product.feed_id + product.item_id to fields."),
  override_segment_group_order: z.array(z.string()).optional(),
  includes: z.array(z.string()).optional(),
};

export function registerInsightTools(server: McpServer) {
  server.tool(
    "get_ad_account_insights",
    "Get ad account insights aggregated by time granularity. Attribution for current local day is preliminary. Use time_ranges + fields + segments for breakdowns. Paginated (limit/after/before).",
    { ...insightFields },
    async ({ ad_account_id, ...queryRest }) => {
      const query: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of Object.entries(queryRest)) {
        if (v == null) continue;
        if (Array.isArray(v)) query[k] = v as string[];
        else query[k] = String(v);
      }
      const data = await adsRequest({ method: "GET", path: "/ad_account/insights", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_campaign_insights",
    "Get campaign insights. Chain from list_campaigns -> campaign_id. Same params as ad account insights but scoped to one campaign.",
    {
      ad_account_id: z.string().optional(),
      campaign_id: z.string().min(1).describe("Campaign ID."),
      time_granularity: insightFields.time_granularity,
      aggregation_level: insightFields.aggregation_level,
      limit: insightFields.limit,
      before: insightFields.before,
      after: insightFields.after,
      time_ranges: insightFields.time_ranges,
      filters: insightFields.filters,
      fields: insightFields.fields,
      sort: insightFields.sort,
      segments: insightFields.segments,
      override_segment_group_order: insightFields.override_segment_group_order,
      includes: insightFields.includes,
    },
    async ({ ad_account_id, campaign_id, ...rest }) => {
      const query: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v == null) continue;
        if (Array.isArray(v)) query[k] = v as string[];
        else query[k] = String(v);
      }
      const data = await adsRequest({
        method: "GET",
        path: `/campaigns/${encodeURIComponent(campaign_id)}/insights`,
        query,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_ad_group_insights",
    "Get ad group insights. Chain from list_ad_groups -> ad_group_id.",
    {
      ad_account_id: z.string().optional(),
      ad_group_id: z.string().min(1).describe("Ad group ID."),
      time_granularity: insightFields.time_granularity,
      aggregation_level: insightFields.aggregation_level,
      limit: insightFields.limit,
      before: insightFields.before,
      after: insightFields.after,
      time_ranges: insightFields.time_ranges,
      filters: insightFields.filters,
      fields: insightFields.fields,
      sort: insightFields.sort,
      segments: insightFields.segments,
      override_segment_group_order: insightFields.override_segment_group_order,
      includes: insightFields.includes,
    },
    async ({ ad_account_id, ad_group_id, ...rest }) => {
      const query: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v == null) continue;
        if (Array.isArray(v)) query[k] = v as string[];
        else query[k] = String(v);
      }
      const data = await adsRequest({
        method: "GET",
        path: `/ad_groups/${encodeURIComponent(ad_group_id)}/insights`,
        query,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_ad_insights",
    "Get ad insights for a single ad. Check creative-level performance.",
    {
      ad_account_id: z.string().optional(),
      ad_id: z.string().min(1).describe("Ad ID."),
      time_granularity: insightFields.time_granularity,
      aggregation_level: insightFields.aggregation_level,
      limit: insightFields.limit,
      before: insightFields.before,
      after: insightFields.after,
      time_ranges: insightFields.time_ranges,
      filters: insightFields.filters,
      fields: insightFields.fields,
      sort: insightFields.sort,
      segments: insightFields.segments,
      override_segment_group_order: insightFields.override_segment_group_order,
      includes: insightFields.includes,
    },
    async ({ ad_account_id, ad_id, ...rest }) => {
      const query: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v == null) continue;
        if (Array.isArray(v)) query[k] = v as string[];
        else query[k] = String(v);
      }
      const data = await adsRequest({
        method: "GET",
        path: `/ads/${encodeURIComponent(ad_id)}/insights`,
        query,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_conversion_insights",
    "Get attributed conversion totals or daily values. POST /conversions/insights. Requires aggregation_level + time_ranges. Use breakdown (device/country) for segments. group_by_entity splits per campaign/ad_group/ad.",
    {
      ad_account_id: z.string().optional(),
      aggregation_level: z.enum(["ad_account", "campaign", "ad_group", "ad"]).describe("Aggregation level (required)."),
      time_granularity: z.enum(["none", "daily"]).optional().describe("none=totals, daily=daily breakdown."),
      breakdown: z.enum(["device", "country"]).optional().describe("Optional breakdown dimension."),
      time_ranges: z.array(z.string()).min(1).describe("Time ranges (required). Example: [\"2026-01-01:2026-01-31\"]"),
      entity_ids: z.array(z.string()).optional().describe("Filter to specific campaign/ad_group/ad IDs."),
      group_by_entity: z.boolean().optional().describe("Split results per entity_id."),
      include_zero_rows: z.boolean().optional().describe("Include rows with zero conversions."),
    },
    async ({ ad_account_id, ...body }) => {
      const data = await adsRequest({
        method: "POST",
        path: "/conversions/insights",
        body,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
