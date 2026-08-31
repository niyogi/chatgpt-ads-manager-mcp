import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest } from "../lib/ads-client.js";

export function registerBusinessAgentTools(server: McpServer) {
  server.tool(
    "list_business_agent_tools",
    "List eligible Business Agent tools installed for the authenticated API project. Use to discover connectors/tools available for business agent creation.",
    {},
    async () => {
      const data = await adsRequest({ method: "GET", path: "/business_agent_tools" });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_business_agents",
    "List Business Agents for the ad account. Each has id, name, status draft/published, etc.",
    {
      ad_account_id: z.string().optional(),
    },
    async ({ ad_account_id }) => {
      const data = await adsRequest({ method: "GET", path: "/business_agents", adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_business_agent",
    "Create a draft Business Agent. Requires name 1–50 + instructions 1–4000. Optionally attach product feeds, connectors, lead form. Publish separately via publish_business_agent.",
    {
      ad_account_id: z.string().optional(),
      name: z.string().min(1).max(50).describe("Agent name 1–50 chars."),
      instructions: z.string().min(1).max(4000).describe("Agent instructions 1–4000 chars."),
      description: z.string().min(1).max(300).optional().describe("Description 1–300 chars."),
      privacy_policy_url: z.string().url().optional().describe("Privacy policy https URL."),
      conversation_starters: z.array(z.string().max(300)).max(12).optional().describe("Up to 12 starters, each max 300."),
      product_feed_ids: z.array(z.string()).max(50).optional().describe("Up to 50 product feed IDs."),
      connector_ids: z.array(z.string()).max(50).optional().describe("Up to 50 connector IDs."),
      tools: z.array(z.record(z.unknown())).max(50).optional().describe("Up to 50 tool definitions."),
      lead_form: z
        .object({
          lead_form_id: z.string().min(1),
          lead_form_revision_id: z.string().optional(),
        })
        .optional()
        .describe("Lead form linkage."),
    },
    async ({ ad_account_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      if (clean.privacy_policy_url) {
        const { validateExternalUrl } = await import("../lib/ssrf-guard.js");
        validateExternalUrl(clean.privacy_policy_url as string, { requireHttps: true, paramName: "privacy_policy_url" });
      }
      const data = await adsRequest({ method: "POST", path: "/business_agents", body: clean, adAccountId: ad_account_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_business_agent",
    "Get a Business Agent by ID.",
    {
      ad_account_id: z.string().optional(),
      business_agent_id: z.string().min(1).describe("Business agent ID."),
    },
    async ({ ad_account_id, business_agent_id }) => {
      const data = await adsRequest({
        method: "GET",
        path: `/business_agents/${encodeURIComponent(business_agent_id)}`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_business_agent",
    "Replace a Business Agent's name and config and save as draft. Omitted optional fields reset to defaults (except lead_form preserved if omitted; send null to unlink). Requires full desired state.",
    {
      ad_account_id: z.string().optional(),
      business_agent_id: z.string().min(1).describe("Business agent ID."),
      name: z.string().min(1).max(50).describe("Agent name 1–50 chars (required for update)."),
      instructions: z.string().min(1).max(4000).describe("Instructions 1–4000 chars."),
      description: z.string().min(1).max(300).nullable().optional(),
      privacy_policy_url: z.string().url().nullable().optional(),
      conversation_starters: z.array(z.string().max(300)).max(12).nullable().optional(),
      product_feed_ids: z.array(z.string()).max(50).optional(),
      connector_ids: z.array(z.string()).max(50).optional(),
      tools: z.array(z.record(z.unknown())).max(50).optional(),
      lead_form: z
        .object({ lead_form_id: z.string().min(1), lead_form_revision_id: z.string().optional() })
        .nullable()
        .optional(),
    },
    async ({ ad_account_id, business_agent_id, ...body }) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
      if (clean.privacy_policy_url && typeof clean.privacy_policy_url === "string") {
        const { validateExternalUrl } = await import("../lib/ssrf-guard.js");
        validateExternalUrl(clean.privacy_policy_url, { requireHttps: true, paramName: "privacy_policy_url" });
      }
      const data = await adsRequest({
        method: "POST",
        path: `/business_agents/${encodeURIComponent(business_agent_id)}`,
        body: clean,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "preview_business_agent",
    "Preview a response from a Business Agent. Useful for QA before publishing. Provide a test message.",
    {
      ad_account_id: z.string().optional(),
      business_agent_id: z.string().min(1).describe("Business agent ID."),
      message: z.string().min(1).describe("Test user message to preview."),
      conversation_id: z.string().optional().describe("Optional conversation ID for context."),
    },
    async ({ ad_account_id, business_agent_id, message, conversation_id }) => {
      const body: Record<string, unknown> = { message };
      if (conversation_id) body.conversation_id = conversation_id;
      const data = await adsRequest({
        method: "POST",
        path: `/business_agents/${encodeURIComponent(business_agent_id)}/preview`,
        body,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "publish_business_agent",
    "Publish a Business Agent draft to make it live. Ensure preview looks good first.",
    {
      ad_account_id: z.string().optional(),
      business_agent_id: z.string().min(1).describe("Business agent ID."),
    },
    async ({ ad_account_id, business_agent_id }) => {
      const data = await adsRequest({
        method: "POST",
        path: `/business_agents/${encodeURIComponent(business_agent_id)}/publish`,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
