import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest, requireIdempotencyKey } from "../lib/ads-client.js";

export function registerLeadFormTools(server: McpServer) {
  server.tool(
    "list_lead_forms",
    "List Lead Forms for the ad account.",
    {
      ad_account_id: z.string().optional(),
    },
    async ({ ad_account_id }) => {
      const data = await adsRequest({ method: "GET", path: "/lead_forms", adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_lead_form",
    "Create a draft Lead Form. Requires name 1–256 + fields 3–5 (each: field_id, field_type text|choice, label, required, options for choice). Publish after creation.",
    {
      ad_account_id: z.string().optional(),
      name: z.string().min(1).max(256).describe("Form name 1–256 chars."),
      description: z.string().max(1000).optional().describe("Optional description."),
      fields: z
        .array(
          z.object({
            field_id: z.string().min(1).max(128),
            field_type: z.enum(["text", "choice"]),
            label: z.string().min(1).max(256),
            required: z.boolean(),
            options: z
              .array(z.object({ id: z.string().min(1).max(128), label: z.string().min(1).max(256) }))
              .max(100)
              .optional(),
          })
        )
        .min(3)
        .max(5)
        .describe("3–5 fields."),
      privacy_policy_url: z.string().url().optional().describe("Privacy policy URL."),
    },
    async ({ ad_account_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      if (clean.privacy_policy_url) {
        const { validateExternalUrl } = await import("../lib/ssrf-guard.js");
        validateExternalUrl(clean.privacy_policy_url as string, { requireHttps: true, paramName: "privacy_policy_url" });
      }
      const data = await adsRequest({ method: "POST", path: "/lead_forms", body: clean, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_lead_form",
    "Get a Lead Form by ID. Optionally specify rev_id for a specific revision.",
    {
      ad_account_id: z.string().optional(),
      lead_form_id: z.string().min(1).describe("Lead form ID."),
      rev_id: z.string().min(1).max(256).optional().describe("Revision ID."),
    },
    async ({ ad_account_id, lead_form_id, rev_id }) => {
      const query: Record<string, string | undefined> = {};
      if (rev_id) query.rev_id = rev_id;
      const data = await adsRequest({
        method: "GET",
        path: `/lead_forms/${encodeURIComponent(lead_form_id)}`,
        query,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_lead_form",
    "Save a new draft revision for a Lead Form. Requires expected_draft_revision_id for conflict detection.",
    {
      ad_account_id: z.string().optional(),
      lead_form_id: z.string().min(1).describe("Lead form ID."),
      expected_draft_revision_id: z.string().optional().describe("Current draft revision ID from get_lead_form for optimistic locking."),
      name: z.string().min(1).max(256).optional(),
      description: z.string().max(1000).nullable().optional(),
      fields: z
        .array(
          z.object({
            field_id: z.string().min(1).max(128),
            field_type: z.enum(["text", "choice"]),
            label: z.string().min(1).max(256),
            required: z.boolean(),
            options: z.array(z.object({ id: z.string().min(1).max(128), label: z.string().min(1).max(256) })).max(100).optional(),
          })
        )
        .min(3)
        .max(5)
        .optional(),
      privacy_policy_url: z.string().url().nullable().optional(),
    },
    async ({ ad_account_id, lead_form_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      if (clean.privacy_policy_url && typeof clean.privacy_policy_url === "string") {
        const { validateExternalUrl } = await import("../lib/ssrf-guard.js");
        validateExternalUrl(clean.privacy_policy_url, { requireHttps: true, paramName: "privacy_policy_url" });
      }
      const data = await adsRequest({
        method: "POST",
        path: `/lead_forms/${encodeURIComponent(lead_form_id)}`,
        body: clean,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "publish_lead_form",
    "Publish the current Lead Form draft. After publishing, the form can be attached to a Business Agent.",
    {
      ad_account_id: z.string().optional(),
      lead_form_id: z.string().min(1).describe("Lead form ID."),
    },
    async ({ ad_account_id, lead_form_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/lead_forms/${encodeURIComponent(lead_form_id)}/publish`,
        body: {},
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "archive_lead_form",
    "Archive a Lead Form that is not attached to a published Business Agent.",
    {
      ad_account_id: z.string().optional(),
      lead_form_id: z.string().min(1).describe("Lead form ID."),
    },
    async ({ ad_account_id, lead_form_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/lead_forms/${encodeURIComponent(lead_form_id)}/archive`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_test_lead_submission",
    "Queue a synthetic signed lead-sync webhook test delivery for a Lead Form. Requires Idempotency-Key. Useful to validate webhook handling before going live.",
    {
      ad_account_id: z.string().optional(),
      lead_form_id: z.string().min(1).describe("Lead form ID."),
      idempotency_key: z.string().min(1).max(255).describe("Required idempotency key."),
      field_values: z.record(z.string()).optional().describe("Optional synthetic field values keyed by field_id."),
    },
    async ({ ad_account_id, lead_form_id, idempotency_key, field_values }) => {
      const body: Record<string, unknown> = {};
      if (field_values) body.field_values = field_values;
      const data = await adsRequest({
        method: "POST",
        path: `/lead_forms/${encodeURIComponent(lead_form_id)}/test_submissions`,
        body,
        adAccountId: ad_account_id,
        idempotencyKey: requireIdempotencyKey(idempotency_key),
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
