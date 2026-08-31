import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest, requireIdempotencyKey } from "../lib/ads-client.js";

export function registerAudienceTools(server: McpServer) {
  server.tool(
    "list_custom_audiences",
    "List custom audiences. Filter by intended_use, ids, or policy_revision for eligibility. Returns audiences with membership_revision for mutations. Paginated.",
    {
      ad_account_id: z.string().optional(),
      intended_use: z.enum(["inclusion", "exclusion", "bid_multiplier"]).optional().describe("Filter by intended use."),
      custom_audience_ids: z.array(z.string()).max(500).optional().describe("Filter to specific IDs (max 500)."),
      policy_revision: z.string().length(64).optional().describe("64-char hash for eligibility recheck."),
      matched_count_granularity: z.enum(["granular"]).optional(),
      limit: z.number().int().min(1).max(500).optional(),
      after: z.string().optional(),
      before: z.string().optional(),
      order: z.enum(["asc", "desc"]).optional(),
    },
    async ({ ad_account_id, ...rest }) => {
      const query: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v == null) continue;
        if (Array.isArray(v)) query[k] = v as string[];
        else query[k] = String(v);
      }
      const data = await adsRequest({ method: "GET", path: "/custom_audiences", query, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_custom_audience",
    "Create a custom audience from an uploaded file (provide file_id) or as empty/small audience if enabled. Processing is async — poll via get_custom_audience until published. Returns custom_audience_id.",
    {
      ad_account_id: z.string().optional(),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).describe("Audience name 3–1000 chars."),
      description: z.string().optional().describe("Optional description."),
      file_id: z.string().optional().describe("File ID from upload_audience_file (omit for empty audience if enabled)."),
      identifier_type: z.enum(["email", "phone", "email_sha256", "phone_number_sha256", "gaid"]).optional().describe("Identifier type if file has single column."),
      identifier_resolution: z.enum(["auto"]).optional().describe("Use auto for mixed CSV with headers email,phone_number,email_sha256,phone_number_sha256,gaid."),
      filename: z.string().min(1).max(255).optional().describe("Original filename .csv/.txt."),
      mimetype: z.enum(["text/csv", "text/plain"]).optional(),
      file_size: z.number().int().min(1).max(500000000).optional().describe("File size bytes 1–500M."),
    },
    async ({ ad_account_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      const data = await adsRequest({ method: "POST", path: "/custom_audiences", body: clean, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_custom_audience",
    "Get a custom audience by ID. Check processing state and membership_revision before mutations.",
    {
      ad_account_id: z.string().optional(),
      custom_audience_id: z.string().min(1).describe("Custom audience ID."),
      matched_count_granularity: z.enum(["granular"]).optional(),
    },
    async ({ ad_account_id, custom_audience_id, matched_count_granularity }) => {
      const query: Record<string, string | undefined> = {};
      if (matched_count_granularity) query.matched_count_granularity = matched_count_granularity;
      const data = await adsRequest({
        method: "GET",
        path: `/custom_audiences/${encodeURIComponent(custom_audience_id)}`,
        query,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "archive_custom_audience",
    "Archive a custom audience. Archived audiences cannot be used for targeting.",
    {
      ad_account_id: z.string().optional(),
      custom_audience_id: z.string().min(1).describe("Custom audience ID."),
    },
    async ({ ad_account_id, custom_audience_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/custom_audiences/${encodeURIComponent(custom_audience_id)}/archive`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "add_audience_members",
    "Add identifiers to an existing custom audience (file or inline). Requires Idempotency-Key and expected_revision. Poll operation via get_audience_operation. Supports up to ~10k inline identifiers; use file for larger.",
    {
      ad_account_id: z.string().optional(),
      custom_audience_id: z.string().min(1).describe("Custom audience ID."),
      idempotency_key: z.string().min(1).max(255).describe("Required idempotency key 1–255 chars. Save to resume on 503/409."),
      expected_revision: z.number().int().min(0).describe("Current membership_revision from get_custom_audience."),
      file_id: z.string().optional().describe("File ID from upload_audience_file."),
      identifiers: z
        .array(
          z.object({
            identifier_type: z.enum(["email", "phone", "email_sha256", "phone_number_sha256", "gaid"]),
            identifier: z.string().min(1),
          })
        )
        .optional()
        .describe("Inline identifiers (alternative to file_id)."),
      identifier_type: z.enum(["email", "phone", "email_sha256", "phone_number_sha256", "gaid"]).optional(),
      identifier_resolution: z.enum(["auto"]).optional(),
    },
    async ({ ad_account_id, custom_audience_id, idempotency_key, ...body }) => {
      if (!body.file_id && !body.identifiers) throw new Error("Provide either file_id or identifiers.");
      const data = await adsRequest({
        method: "POST",
        path: `/custom_audiences/${encodeURIComponent(custom_audience_id)}/add`,
        body,
        adAccountId: ad_account_id,
        idempotencyKey: requireIdempotencyKey(idempotency_key),
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "remove_audience_members",
    "Remove identifiers from a custom audience (file or inline). Requires Idempotency-Key and expected_revision. Poll via get_audience_operation.",
    {
      ad_account_id: z.string().optional(),
      custom_audience_id: z.string().min(1).describe("Custom audience ID."),
      idempotency_key: z.string().min(1).max(255).describe("Required idempotency key."),
      expected_revision: z.number().int().min(0).describe("Current membership_revision."),
      file_id: z.string().optional(),
      identifiers: z
        .array(
          z.object({
            identifier_type: z.enum(["email", "phone", "email_sha256", "phone_number_sha256", "gaid"]),
            identifier: z.string().min(1),
          })
        )
        .optional(),
      identifier_type: z.enum(["email", "phone", "email_sha256", "phone_number_sha256", "gaid"]).optional(),
      identifier_resolution: z.enum(["auto"]).optional(),
    },
    async ({ ad_account_id, custom_audience_id, idempotency_key, ...body }) => {
      if (!body.file_id && !body.identifiers) throw new Error("Provide either file_id or identifiers.");
      const data = await adsRequest({
        method: "POST",
        path: `/custom_audiences/${encodeURIComponent(custom_audience_id)}/remove`,
        body,
        adAccountId: ad_account_id,
        idempotencyKey: requireIdempotencyKey(idempotency_key),
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "replace_audience_members",
    "Replace all members of a custom audience using an uploaded file and current revision. Requires Idempotency-Key. Poll via get_audience_operation.",
    {
      ad_account_id: z.string().optional(),
      custom_audience_id: z.string().min(1).describe("Custom audience ID."),
      idempotency_key: z.string().min(1).max(255).describe("Required idempotency key."),
      expected_revision: z.number().int().min(0).describe("Current membership_revision (required)."),
      file_id: z.string().min(1).describe("Replacement file ID from upload_audience_file."),
      filename: z.string().optional(),
      mimetype: z.enum(["text/csv", "text/plain"]).optional(),
      file_size: z.number().int().optional(),
      identifier_type: z.enum(["email", "phone", "email_sha256", "phone_number_sha256", "gaid"]).optional(),
      identifier_resolution: z.enum(["auto"]).optional(),
    },
    async ({ ad_account_id, custom_audience_id, idempotency_key, ...body }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/custom_audiences/${encodeURIComponent(custom_audience_id)}/replace`,
        body,
        adAccountId: ad_account_id,
        idempotencyKey: requireIdempotencyKey(idempotency_key),
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "merge_custom_audiences",
    "Create a new audience containing all matched members from 2–64 source audiences. Independent copy. Requires Idempotency-Key.",
    {
      ad_account_id: z.string().optional(),
      idempotency_key: z.string().min(1).max(255).describe("Required idempotency key."),
      name: z.string().min(3).max(1000).regex(/.*\S.*/).describe("Name for merged audience 3–1000 chars."),
      custom_audience_ids: z.array(z.string().min(1)).min(2).max(64).describe("2–64 source audience IDs to merge."),
      description: z.string().optional(),
    },
    async ({ ad_account_id, idempotency_key, ...body }) => {
      const data = await adsRequest({
        method: "POST",
        path: "/custom_audiences/merge",
        body,
        adAccountId: ad_account_id,
        idempotencyKey: requireIdempotencyKey(idempotency_key),
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_audience_operation",
    "Retrieve lifecycle state of a custom audience mutation (add/remove/replace/merge). Poll with backoff. States: processing → succeeded/failed. Save operation_id from mutation response.",
    {
      ad_account_id: z.string().optional(),
      custom_audience_id: z.string().min(1).describe("Custom audience ID."),
      operation_id: z.string().min(1).max(128).describe("Operation ID from mutation response."),
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
