export function buildPaginationQuery(params: {
  limit?: number;
  after?: string;
  before?: string;
  order?: string;
  name?: string;
  include?: string[];
  campaign_id?: string;
  ad_group_id?: string;
  [k: string]: unknown;
}): URLSearchParams {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.after) sp.set("after", params.after);
  if (params.before) sp.set("before", params.before);
  if (params.order) sp.set("order", params.order);
  if (params.name) sp.set("name", params.name);
  if (params.campaign_id) sp.set("campaign_id", params.campaign_id);
  if (params.ad_group_id) sp.set("ad_group_id", params.ad_group_id);
  if (params.include && Array.isArray(params.include)) {
    for (const v of params.include) sp.append("include", String(v));
  }
  return sp;
}

export function formatListResponse(json: unknown): unknown {
  // Pass through as-is but ensure we surface pagination hints in the text channel too.
  return json;
}
