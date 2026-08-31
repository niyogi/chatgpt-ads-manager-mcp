import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest } from "../lib/ads-client.js";

export function registerGeoPartnerTools(server: McpServer) {
  server.tool(
    "search_geo_lookup",
    "Search DMA and standard region codes for advertiser geo targeting. Use returned location IDs with campaign targeting.locations.include. Chain: search_geo_lookup {q:'California'} -> create_campaign {targeting:{locations:{include:[...ids]}}}",
    {
      ad_account_id: z.string().optional(),
      q: z.string().min(1).describe("Search query (e.g., 'California', 'New York DMA', 'US-CA')."),
      limit: z.number().int().min(1).max(100).optional().describe("Max results 1–100."),
    },
    async ({ ad_account_id, q, limit }) => {
      const query: Record<string, string | undefined> = { q };
      if (limit) query.limit = String(limit);
      const data = await adsRequest({ method: "GET", path: "/geo_lookup/search", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_partner_data_upload",
    "Create an Ads partner-data upload (for partner integrations). Returns upload id for polling via get_partner_data_upload.",
    {
      ad_account_id: z.string().optional(),
      upload_type: z.string().optional().describe("Upload type string (per partner docs)."),
      file_id: z.string().optional().describe("File ID if uploading data file."),
    },
    async ({ ad_account_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      const data = await adsRequest({
        method: "POST",
        path: "/partner_data/uploads",
        body: Object.keys(clean).length ? clean : {},
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_partner_data_upload",
    "Get an Ads partner-data upload by ID (e.g., pdu_...). Poll to check processing status.",
    {
      ad_account_id: z.string().optional(),
      upload_id: z.string().regex(/^pdu_[0-9a-f]{32}$/).describe("Upload ID matching pdu_[0-9a-f]{32}."),
    },
    async ({ ad_account_id, upload_id }) => {
      const data = await adsRequest({
        method: "GET",
        path: `/partner_data/uploads/${encodeURIComponent(upload_id)}`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
