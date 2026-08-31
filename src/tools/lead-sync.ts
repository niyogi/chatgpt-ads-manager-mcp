import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest, requireIdempotencyKey } from "../lib/ads-client.js";

export function registerLeadSyncTools(server: McpServer) {
  server.tool(
    "create_lead_sync_subscription",
    "Provision lead delivery to a managed webhook endpoint for an ad account. Requires Idempotency-Key and destination URL. Leads will be POSTed with Standard Webhooks HMAC signature.",
    {
      ad_account_id: z.string().optional(),
      idempotency_key: z.string().min(1).max(255).describe("Required idempotency key."),
      url: z.string().url().describe("Webhook destination https URL."),
      ad_account_ids: z.array(z.string()).optional().describe("Ad account IDs to subscribe (often just one)."),
    },
    async ({ ad_account_id, idempotency_key, url, ad_account_ids }) => {
      const { validateExternalUrl } = await import("../lib/ssrf-guard.js");
      validateExternalUrl(url, { requireHttps: true, paramName: "url" });
      const body: Record<string, unknown> = { url };
      if (ad_account_ids) body.ad_account_ids = ad_account_ids;
      const data = await adsRequest({
        method: "POST",
        path: "/lead_sync_subscriptions",
        body,
        adAccountId: ad_account_id,
        idempotencyKey: requireIdempotencyKey(idempotency_key),
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_lead_sync_subscriptions",
    "List lead-sync subscriptions for an ad account. Requires ad_account_id query param.",
    {
      ad_account_id: z.string().describe("Ad account ID to list subscriptions for (required query param)."),
    },
    async ({ ad_account_id }) => {
      const query: Record<string, string> = { ad_account_id };
      const data = await adsRequest({ method: "GET", path: "/lead_sync_subscriptions", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_lead_sync_subscription",
    "Get a lead-sync subscription by ID.",
    {
      ad_account_id: z.string().optional(),
      subscription_id: z.string().min(1).describe("Subscription ID (leadsync_...)."),
    },
    async ({ ad_account_id, subscription_id }) => {
      const data = await adsRequest({
        method: "GET",
        path: `/lead_sync_subscriptions/${encodeURIComponent(subscription_id)}`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_lead_sync_subscription",
    "Delete a lead-sync subscription to stop webhook delivery.",
    {
      ad_account_id: z.string().optional(),
      subscription_id: z.string().min(1).describe("Subscription ID."),
    },
    async ({ ad_account_id, subscription_id }) => {
      const data = await adsRequest({
        method: "DELETE",
        path: `/lead_sync_subscriptions/${encodeURIComponent(subscription_id)}`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
