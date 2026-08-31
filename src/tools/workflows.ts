import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest } from "../lib/ads-client.js";
import { validateExternalUrl } from "../lib/ssrf-guard.js";

export function registerWorkflowTools(server: McpServer) {
  server.tool(
    "create_campaign_hierarchy",
    "Composite workflow: create a full campaign -> ad group -> ad chain in one call. Useful for quick end-to-end creation. Returns all three IDs. If any step fails, earlier objects remain — use update/archive tools to clean up. Prefer atomic tools (create_campaign, create_ad_group, create_ad) for fine-grained control.",
    {
      ad_account_id: z.string().optional(),
      idempotency_key: z.string().min(1).max(255).optional().describe("Base key for idempotency; suffixed with -campaign/-adgroup/-ad if provided."),
      campaign: z
        .object({
          name: z.string().min(3).max(1000).regex(/.*\S.*/),
          status: z.enum(["active", "paused"]).optional(),
          budget: z
            .object({
              lifetime_spend_limit_micros: z.number().int().min(1_000_000).optional(),
              daily_spend_limit_micros: z.number().int().min(1_000_000).optional(),
            })
            .optional(),
          description: z.string().optional(),
          start_time: z.number().int().optional(),
          end_time: z.number().int().optional(),
          bidding_type: z.enum(["impressions", "clicks", "conversions"]).optional(),
          objective: z.enum(["reach", "clicks", "conversions"]).optional(),
          billing_event_type: z.enum(["impression", "click"]).optional(),
          targeting: z.record(z.unknown()).optional(),
          conversion_event_setting_ids: z.array(z.string()).optional(),
        })
        .describe("Campaign payload (same as create_campaign without ad_account_id)."),
      ad_group: z
        .object({
          name: z.string().min(3).max(1000).regex(/.*\S.*/),
          status: z.enum(["active", "paused"]).optional(),
          description: z.string().optional(),
          context_hints: z.array(z.string()).optional(),
          bidding_config: z.object({
            billing_event_type: z.enum(["impression", "click"]),
            strategy: z.string().optional(),
            max_bid_micros: z.number().int().min(1).max(30400000000000).optional(),
          }),
          product_set: z
            .object({
              product_feed_id: z.string(),
              filters: z
                .array(z.object({ field: z.string(), operator: z.enum(["in", "gt", "gte", "lt", "lte"]), values: z.array(z.string()) }))
                .optional(),
            })
            .optional(),
        })
        .describe("Ad group payload (campaign_id auto-injected)."),
      ad: z
        .object({
          name: z.string().min(3).max(1000).regex(/.*\S.*/).optional(),
          status: z.enum(["active", "paused"]).optional(),
          creative: z.object({
            type: z.enum(["chat_card", "product_ad_template"]),
            title: z.string().min(3).max(50).regex(/.*\S.*/),
            body: z.string().max(1000).optional(),
            price: z.string().max(100).optional(),
            target_url: z.string().max(2048).optional(),
            file_id: z.string().optional(),
            image_crop: z.record(z.unknown()).optional(),
          }),
        })
        .describe("Ad payload (ad_group_id auto-injected)."),
    },
    async ({ ad_account_id, idempotency_key, campaign, ad_group, ad }) => {
      const baseKey = idempotency_key?.trim();
      if (ad.creative?.target_url) {
        validateExternalUrl(ad.creative.target_url, { requireHttps: true, paramName: "ad.creative.target_url" });
      }

      // Step 1: campaign
      const campRes = (await adsRequest({
        method: "POST",
        path: "/campaigns",
        body: campaign,
        adAccountId: ad_account_id,
        idempotencyKey: baseKey ? `${baseKey}-campaign` : undefined,
      })) as Record<string, unknown>;

      const campaignId = extractId(campRes);
      if (!campaignId) throw new Error(`Campaign created but no ID found in response: ${JSON.stringify(campRes).slice(0, 800)}`);

      // Step 2: ad group
      const adGroupBody = { ...ad_group, campaign_id: campaignId };
      const adGroupRes = (await adsRequest({
        method: "POST",
        path: "/ad_groups",
        body: adGroupBody,
        adAccountId: ad_account_id,
        idempotencyKey: baseKey ? `${baseKey}-adgroup` : undefined,
      })) as Record<string, unknown>;

      const adGroupId = extractId(adGroupRes);
      if (!adGroupId) throw new Error(`Ad group created but no ID found: ${JSON.stringify(adGroupRes).slice(0, 800)}`);

      // Step 3: ad
      const adBody: Record<string, unknown> = { ...ad, ad_group_id: adGroupId };
      const adRes = (await adsRequest({
        method: "POST",
        path: "/ads",
        body: adBody,
        adAccountId: ad_account_id,
        idempotencyKey: baseKey ? `${baseKey}-ad` : undefined,
      })) as Record<string, unknown>;

      const adId = extractId(adRes);

      const summary = {
        campaign: campRes,
        ad_group: adGroupRes,
        ad: adRes,
        ids: { campaign_id: campaignId, ad_group_id: adGroupId, ad_id: adId },
        next_steps: [
          `Campaign ${campaignId} ready — use get_campaign or activate_campaign.`,
          `Ad group ${adGroupId} ready — use get_ad_group.`,
          `Ad ${adId} ready — check review_status via get_ad, create preview via create_ad_preview.`,
        ],
      };
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    "poll_audience_operation",
    "Helper to poll a custom audience mutation until terminal. Calls get_audience_operation once and returns current state. Call repeatedly with backoff (processing -> succeeded/failed). Does NOT loop internally — agent controls retry timing to respect rate limits.",
    {
      ad_account_id: z.string().optional(),
      custom_audience_id: z.string().min(1).describe("Custom audience ID."),
      operation_id: z.string().min(1).max(128).describe("Operation ID from add/remove/replace/merge."),
    },
    async ({ ad_account_id, custom_audience_id, operation_id }) => {
      const data = await adsRequest({
        method: "GET",
        path: `/custom_audiences/${encodeURIComponent(custom_audience_id)}/operations/${encodeURIComponent(operation_id)}`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}

function extractId(res: Record<string, unknown>): string | undefined {
  // API returns varied shapes: {id}, {data:{id}}, {campaign:{id}}, or top-level with object field
  if (typeof res.id === "string") return res.id;
  if (res.data && typeof (res.data as Record<string, unknown>).id === "string") return (res.data as Record<string, unknown>).id as string;
  for (const v of Object.values(res)) {
    if (v && typeof v === "object" && typeof (v as Record<string, unknown>).id === "string") return (v as Record<string, unknown>).id as string;
  }
  // Some list-like wrappers: try first element
  return undefined;
}
