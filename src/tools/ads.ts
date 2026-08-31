import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest } from "../lib/ads-client.js";

export function registerAdTools(server: McpServer) {
  server.tool(
    "list_ads",
    "List ads for the ad account, optionally filtered by campaign_id or ad_group_id. Use ad_id for get_ad / insights / preview.",
    {
      ad_account_id: z.string().optional(),
      campaign_id: z.string().optional().describe("Filter by campaign ID."),
      ad_group_id: z.string().optional().describe("Filter by ad group ID."),
      name: z.string().min(3).max(1000).optional(),
      limit: z.number().int().min(1).max(500).optional(),
      after: z.string().optional(),
      before: z.string().optional(),
      order: z.enum(["asc", "desc"]).optional(),
      include: z.array(z.string()).optional(),
    },
    async ({ ad_account_id, campaign_id, ad_group_id, name, limit, after, before, order, include }) => {
      const query: Record<string, string | string[] | undefined> = {};
      if (campaign_id) query.campaign_id = campaign_id;
      if (ad_group_id) query.ad_group_id = ad_group_id;
      if (name) query.name = name;
      if (limit) query.limit = String(limit);
      if (after) query.after = after;
      if (before) query.before = before;
      if (order) query.order = order;
      if (include) query.include = include;
      const data = await adsRequest({ method: "GET", path: "/ads", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_ad",
    "Get a single ad by ID. Check review_status to monitor approval (typically minutes).",
    {
      ad_account_id: z.string().optional(),
      ad_id: z.string().min(1).describe("Ad ID."),
      include: z.array(z.string()).optional(),
    },
    async ({ ad_account_id, ad_id, include }) => {
      const query: Record<string, string | string[] | undefined> = {};
      if (include) query.include = include;
      const data = await adsRequest({
        method: "GET",
        path: `/ads/${encodeURIComponent(ad_id)}`,
        query,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_ad",
    "Create an ad for an ad group. Requires creative (type/title/body etc.). For chat_card, provide file_id from upload_image. For product_ad_template, use {{product.*}} tokens and omit file_id. Returns ad_id.",
    {
      ad_account_id: z.string().optional(),
      idempotency_key: z.string().min(1).max(255).optional(),
      ad_group_id: z.string().min(1).describe("Parent ad group ID."),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).optional().describe("Ad name."),
      status: z.enum(["active", "paused"]).optional(),
      creative: z
        .object({
          type: z.enum(["chat_card", "product_ad_template"]).describe("Creative type."),
          title: z.string().min(3).max(50).regex(/.*\S.*/).describe("Title 3–50 chars."),
          body: z.string().max(1000).optional().describe("Body up to ~100 chars recommended (max 1000 in schema)."),
          price: z.string().max(100).optional().describe("Price string for product template."),
          target_url: z.string().max(2048).optional().describe("Destination URL (https). Max 2048."),
          file_id: z.string().optional().describe("File ID from upload_image (required for chat_card)."),
          image_crop: z.record(z.unknown()).optional().describe("Normalized square crop for chat_card."),
        })
        .describe("Creative object."),
      description: z.string().optional(),
    },
    async ({ ad_account_id, idempotency_key, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      // Validate target_url if present (SSRF guard, https only)
      if (clean.creative && typeof clean.creative === "object") {
        const cr = clean.creative as Record<string, unknown>;
        if (typeof cr.target_url === "string" && cr.target_url) {
          const { validateExternalUrl } = await import("../lib/ssrf-guard.js");
          validateExternalUrl(cr.target_url, { requireHttps: true, paramName: "creative.target_url" });
        }
      }
      const data = await adsRequest({
        method: "POST",
        path: "/ads",
        body: clean,
        adAccountId: ad_account_id,
        idempotencyKey: idempotency_key?.trim() || undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_ad",
    "Update an ad by ID. Only provided fields are updated.",
    {
      ad_account_id: z.string().optional(),
      ad_id: z.string().min(1).describe("Ad ID."),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).optional(),
      status: z.enum(["active", "paused", "archived"]).optional(),
      creative: z.record(z.unknown()).optional(),
      description: z.string().nullable().optional(),
    },
    async ({ ad_account_id, ad_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      if (clean.creative && typeof clean.creative === "object") {
        const cr = clean.creative as Record<string, unknown>;
        if (typeof cr.target_url === "string" && cr.target_url) {
          const { validateExternalUrl } = await import("../lib/ssrf-guard.js");
          validateExternalUrl(cr.target_url as string, { requireHttps: true, paramName: "creative.target_url" });
        }
      }
      const data = await adsRequest({
        method: "POST",
        path: `/ads/${encodeURIComponent(ad_id)}`,
        body: clean,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_ad_preview",
    "Create a temporary iframe preview for an existing ad. Returns preview URL/html for QA before activating.",
    {
      ad_account_id: z.string().optional(),
      ad_id: z.string().min(1).describe("Ad ID."),
    },
    async ({ ad_account_id, ad_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/ads/${encodeURIComponent(ad_id)}/preview`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "activate_ad",
    "Activate a paused ad. Campaign and ad group must also be active + review approved to serve.",
    {
      ad_account_id: z.string().optional(),
      ad_id: z.string().min(1).describe("Ad ID."),
    },
    async ({ ad_account_id, ad_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/ads/${encodeURIComponent(ad_id)}/activate`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "pause_ad",
    "Pause an active ad.",
    {
      ad_account_id: z.string().optional(),
      ad_id: z.string().min(1).describe("Ad ID."),
    },
    async ({ ad_account_id, ad_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/ads/${encodeURIComponent(ad_id)}/pause`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "archive_ad",
    "Archive an ad (terminal).",
    {
      ad_account_id: z.string().optional(),
      ad_id: z.string().min(1).describe("Ad ID."),
    },
    async ({ ad_account_id, ad_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/ads/${encodeURIComponent(ad_id)}/archive`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
