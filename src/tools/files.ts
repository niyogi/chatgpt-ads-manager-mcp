import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adsRequest } from "../lib/ads-client.js";
import { validateExternalUrl } from "../lib/ssrf-guard.js";

export function registerFileTools(server: McpServer) {
  server.tool(
    "upload_image",
    "Upload a creative image for ads. Provide EITHER image_url (https) OR image_base64 (data). image_url is SSRF-guarded (https only, no private hosts). Returns file_id to use in create_ad creative.file_id. For chat_card ads, upload first then create_ad.",
    {
      ad_account_id: z.string().optional().describe("Optional ad account ID override."),
      image_url: z.string().url().optional().describe("Public https URL of image. SSRF-checked."),
      image_base64: z.string().optional().describe("Base64-encoded image bytes (alternative to image_url). Do NOT include data: prefix — just raw base64."),
      filename: z.string().optional().describe("Filename for base64 upload (e.g., creative.png)."),
    },
    async ({ ad_account_id, image_url, image_base64, filename }) => {
      if (!image_url && !image_base64) {
        throw new Error("Provide either image_url or image_base64.");
      }
      if (image_url && image_base64) {
        throw new Error("Provide only one of image_url or image_base64, not both.");
      }

      if (image_url) {
        validateExternalUrl(image_url, { requireHttps: true, paramName: "image_url" });
        const data = await adsRequest({
          method: "POST",
          path: "/upload",
          body: { image_url },
          adAccountId: ad_account_id,
          headers: { "Content-Type": "application/json" },
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      // base64 -> multipart file upload to /upload
      const bytes = Buffer.from(image_base64!, "base64");
      if (bytes.length === 0) throw new Error("image_base64 decoded to 0 bytes — check it's valid base64.");
      if (bytes.length > 10 * 1024 * 1024) throw new Error("Image exceeds 10MB limit.");
      // Guess mime from filename or bytes
      const name = filename || "upload.png";
      const blob = new Blob([bytes], { type: guessMime(name) });
      const fd = new FormData();
      fd.append("file", blob, name);
      // /upload accepts multipart with file; purpose not required for image but some specs say purpose=account_favicon for favicon
      const data = await adsRequest({
        method: "POST",
        path: "/upload",
        formData: fd,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "upload_audience_file",
    "Upload a file for custom audience creation (CSV/TXT up to 500MB). Returns file_id (oaisdmntci_...) to use in create_custom_audience or add_audience_members. Provide file_base64 (base64 of CSV/TXT). Purpose is always custom_audience.",
    {
      ad_account_id: z.string().optional(),
      file_base64: z.string().describe("Base64-encoded file bytes (CSV/TXT)."),
      filename: z.string().min(1).max(255).describe("Filename with extension .csv or .txt (1–255 chars)."),
      mimetype: z.enum(["text/csv", "text/plain"]).optional().describe("MIME type (default text/csv)."),
    },
    async ({ ad_account_id, file_base64, filename, mimetype }) => {
      if (!filename.endsWith(".csv") && !filename.endsWith(".txt")) {
        throw new Error("filename must end with .csv or .txt");
      }
      const bytes = Buffer.from(file_base64, "base64");
      if (bytes.length === 0) throw new Error("file_base64 decoded to 0 bytes.");
      if (bytes.length > 500 * 1024 * 1024) throw new Error("File exceeds 500MB limit.");
      const blob = new Blob([bytes], { type: mimetype || "text/csv" });
      const fd = new FormData();
      fd.append("file", blob, filename);
      fd.append("purpose", "custom_audience");
      const data = await adsRequest({
        method: "POST",
        path: "/uploads",
        formData: fd,
        adAccountId: ad_account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}

function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/png";
}
