import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest } from "../lib/ads-client.js";

export function registerProductFeedTools(server: McpServer) {
  server.tool(
    "create_product_feed",
    "Create a product feed for the ad account (merchant catalog). For SFTP-fetched catalogs, configure SFTP after. Use list_product_feeds to see existing.",
    {
      ad_account_id: z.string().optional(),
      name: z.string().min(1).max(1000).optional().describe("Feed name."),
      url: z.string().url().optional().describe("Feed URL if hosted."),
    },
    async ({ ad_account_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      if (clean.url) {
        const { validateExternalUrl } = await import("../lib/ssrf-guard.js");
        validateExternalUrl(clean.url as string, { requireHttps: true, paramName: "url" });
      }
      const data = await adsRequest({ method: "POST", path: "/feeds", body: clean, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_product_feeds",
    "List product feeds for the ad account. Use feed_id with query/patch/sftp tools.",
    {
      ad_account_id: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
      after: z.string().optional(),
      before: z.string().optional(),
      order: z.enum(["asc", "desc"]).optional(),
      include: z.array(z.string()).optional(),
    },
    async ({ ad_account_id, limit, after, before, order, include }) => {
      const query: Record<string, string | string[] | undefined> = {};
      if (limit) query.limit = String(limit);
      if (after) query.after = after;
      if (before) query.before = before;
      if (order) query.order = order;
      if (include) query.include = include;
      const data = await adsRequest({ method: "GET", path: "/feeds", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "archive_product_feed",
    "Archive a product feed. Archived feeds cannot be used for new campaigns.",
    {
      ad_account_id: z.string().optional(),
      feed_id: z.string().min(1).describe("Product feed ID."),
    },
    async ({ ad_account_id, feed_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/feeds/${encodeURIComponent(feed_id)}/archive`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_product_feed_uploads",
    "List recent product feed uploads (ingestion history). Useful to debug catalog fetch issues.",
    {
      ad_account_id: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      after: z.string().optional(),
      before: z.string().optional(),
    },
    async ({ ad_account_id, limit, after, before }) => {
      const query: Record<string, string | undefined> = {};
      if (limit) query.limit = String(limit);
      if (after) query.after = after;
      if (before) query.before = before;
      const data = await adsRequest({ method: "GET", path: "/feeds/uploads", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "query_product_feed_products",
    "List products in a feed matching ad group product filters. Use to validate targeting before creating ad_group with product_set.",
    {
      ad_account_id: z.string().optional(),
      feed_id: z.string().min(1).describe("Product feed ID."),
      filters: z
        .array(
          z.object({
            field: z.string(),
            operator: z.enum(["in", "gt", "gte", "lt", "lte"]),
            values: z.array(z.string()),
          })
        )
        .optional()
        .describe("Product filters (field/operator/values)."),
      limit: z.number().int().min(1).max(100).optional(),
      after: z.string().optional(),
    },
    async ({ ad_account_id, feed_id, filters, limit, after }) => {
      const body: Record<string, unknown> = {};
      if (filters) body.filters = filters;
      if (limit) body.limit = limit;
      if (after) body.after = after;
      const data = await adsRequest({
        method: "POST",
        path: `/feeds/${encodeURIComponent(feed_id)}/products/query`,
        body,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "patch_product_feed_products",
    "Update product availability and prices for a feed (delta without full SFTP re-upload). Provide product patches with item identifiers.",
    {
      ad_account_id: z.string().optional(),
      feed_id: z.string().min(1).describe("Product feed ID."),
      products: z
        .array(
          z.object({
            item_id: z.string().optional(),
            availability: z.string().optional().describe("e.g., in_stock, out_of_stock"),
            price: z.string().optional().describe("Price string, e.g., '19.99 USD'"),
          })
        )
        .min(1)
        .describe("Products to patch (availability/price)."),
    },
    async ({ ad_account_id, feed_id, products }) => {
      const data = await adsRequest({
        method: "PATCH",
        path: `/feeds/${encodeURIComponent(feed_id)}/products`,
        body: { products },
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_product_feed_sftp_access",
    "Get SFTP access details for a product feed (host, username, path). Use to configure catalog uploads.",
    {
      ad_account_id: z.string().optional(),
      feed_id: z.string().min(1).describe("Product feed ID."),
    },
    async ({ ad_account_id, feed_id }) => {
      const data = await adsRequest({
        method: "GET",
        path: `/feeds/${encodeURIComponent(feed_id)}/sftp_access`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_product_feed_sftp_access",
    "Create or replace SFTP access credentials for a product feed. Returns credentials to configure your SFTP client.",
    {
      ad_account_id: z.string().optional(),
      feed_id: z.string().min(1).describe("Product feed ID."),
      password: z.string().min(8).optional().describe("SFTP password if setting one (min 8). Otherwise generated."),
    },
    async ({ ad_account_id, feed_id, password }) => {
      const body: Record<string, unknown> = {};
      if (password) body.password = password;
      const data = await adsRequest({
        method: "POST",
        path: `/feeds/${encodeURIComponent(feed_id)}/sftp_access`,
        body: Object.keys(body).length ? body : undefined,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "activate_product_feed_sftp_access",
    "Activate SFTP access for a product feed (resume ingestion).",
    {
      ad_account_id: z.string().optional(),
      feed_id: z.string().min(1).describe("Product feed ID."),
    },
    async ({ ad_account_id, feed_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/feeds/${encodeURIComponent(feed_id)}/sftp_access/activate`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "pause_product_feed_sftp_access",
    "Pause SFTP access for a product feed (stop ingestion).",
    {
      ad_account_id: z.string().optional(),
      feed_id: z.string().min(1).describe("Product feed ID."),
    },
    async ({ ad_account_id, feed_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/feeds/${encodeURIComponent(feed_id)}/sftp_access/pause`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
