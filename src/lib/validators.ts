import { z } from "zod";

export const nonEmptyString = (min: number, max: number) =>
  z.string().min(min).max(max).regex(/.*\S.*/, "Must contain a non-whitespace character");

export const nameField = (min = 3, max = 1000) => nonEmptyString(min, max);

export const adAccountIdSchema = z.string().min(1).describe("Ad account ID (e.g., adacct_123). Falls back to OPENAI_AD_ACCOUNT_ID env if omitted.");
export const campaignIdSchema = z.string().min(1).describe("Campaign ID (e.g., cmpn_...)");
export const adGroupIdSchema = z.string().min(1).describe("Ad group ID (e.g., adgrp_...)");
export const adIdSchema = z.string().min(1).describe("Ad ID (e.g., ad_...)");
export const customAudienceIdSchema = z.string().min(1).describe("Custom audience ID (e.g., caud_...)");
export const fileIdSchema = z.string().min(1).describe("File ID returned by upload tools");
export const feedIdSchema = z.string().min(1).describe("Product feed ID");
export const businessAgentIdSchema = z.string().min(1).describe("Business agent ID");
export const leadFormIdSchema = z.string().min(1).describe("Lead form ID");
export const pixelIdSchema = z.string().min(1).describe("Conversion pixel ID (pid)");

export const paginationSchema = {
  limit: z.number().int().min(1).max(500).optional().describe("Max results (1–500, varies by endpoint; default server-controlled)."),
  after: z.string().optional().describe("Cursor for forward pagination (opaque string from previous response)."),
  before: z.string().optional().describe("Cursor for backward pagination."),
  order: z.enum(["asc", "desc"]).optional().describe("Sort order by creation time."),
};

export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/.*\S.*/, "Idempotency key must contain a non-whitespace character")
  .optional()
  .describe("Optional idempotency key (1–255 chars). Auto-generated if omitted and required by API.");

export const optionalAdAccountId = z.string().optional().describe("Optional ad account ID override. Uses OPENAI_AD_ACCOUNT_ID env if not set. Required for OAuth/shared keys.");

export const budgetSchema = z
  .object({
    lifetime_spend_limit_micros: z.number().int().min(1_000_000).optional().describe("Lifetime spend cap in micros (1 USD = 1,000,000 micros). Min 1,000,000."),
    daily_spend_limit_micros: z.number().int().min(1_000_000).optional().describe("Daily spend cap in micros. Min 1,000,000."),
  })
  .optional();

// Full whitelist of insight-native params per API spec — kept loose as string[] because spec evolves; validated server-side.
// We document common values in descriptions.

export const insightTimeGranularitySchema = z
  .enum(["hourly", "daily", "weekly", "monthly", "all", "none"])
  .optional();
