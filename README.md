# ChatGPT Ads Manager MCP

[![npm version](https://badge.fury.io/js/chatgpt-ads-manager-mcp.svg)](https://www.npmjs.com/package/chatgpt-ads-manager-mcp) [![npm downloads](https://img.shields.io/npm/dm/chatgpt-ads-manager-mcp.svg)](https://www.npmjs.com/package/chatgpt-ads-manager-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Manage your **ChatGPT Advertiser campaigns** from any MCP-capable agent — Claude Desktop, Cursor, VS Code (Copilot), Windsurf, and more.

One `npx` command. No app to install. Your API key stays local on your machine.

> **Published to npm** — `npx -y chatgpt-ads-manager-mcp` pulls the pre-built package from [npmjs.com/package/chatgpt-ads-manager-mcp](https://www.npmjs.com/package/chatgpt-ads-manager-mcp) on demand. No `git clone`, no `npm run build` — just paste a config and restart your agent.

- **Create campaigns → ad groups → ads** (or all three in one chain)
- **Upload creatives**, manage **audiences**, configure **conversions & pixels**
- **Pull insights** at account / campaign / ad group / ad level
- **Business Agents & Lead Forms**, product feeds, geo targeting — everything in the [Advertiser API](https://developers.openai.com/ads/api-overview)

> Built for agents that chain tools. Every `create_*` returns the ID you need for the next call.

---

## 1. Get your API key

1. Open **Ads Manager → Settings → API Keys** at [ads.openai.com](https://ads.openai.com).
2. Create a key (scoped to one ad account) and copy it. It looks like `sk-ads-...`.

Keep it secret — you'll paste it into your MCP config, never into chat.

---

## 2. Add to your agent (copy-paste)

You need `Node.js >= 18`. Check with `node -v`.

All configs below use the **env var** `OPENAI_ADS_API_KEY` (alias `CHATGPT_ADS_API_KEY` also works). For multi-account / partner setups, also set `OPENAI_AD_ACCOUNT_ID` or pass `ad_account_id` per tool call — see §7.

### Claude Desktop

Edit `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "chatgpt-ads-manager": {
      "command": "npx",
      "args": ["-y", "chatgpt-ads-manager-mcp@latest"],
      "env": {
        "OPENAI_ADS_API_KEY": "sk-ads-...paste-your-key..."
      }
    }
  }
}
```

> Tip: `@latest` auto-updates on next agent restart. Pin to a version for reproducibility: `["-y", "chatgpt-ads-manager-mcp@0.1.0"]`. Bare `chatgpt-ads-manager-mcp` also resolves to `@latest`.

Restart Claude Desktop.

### Cursor

**Global** (`~/.cursor/mcp.json` — all projects) or **project-scoped** (`.cursor/mcp.json` — commit without secrets):

```json
{
  "mcpServers": {
    "chatgpt-ads-manager": {
      "command": "npx",
      "args": ["-y", "chatgpt-ads-manager-mcp@latest"],
      "env": {
        "OPENAI_ADS_API_KEY": "sk-ads-...paste-your-key..."
      }
    }
  }
}
```

Settings → Tools & MCP will hot-reload — no restart needed.

### VS Code (Copilot / MCP extension)

Create `.vscode/mcp.json` in your workspace (note `servers` + `type: "stdio"` — VS Code's variant):

```json
{
  "servers": {
    "chatgpt-ads-manager": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "chatgpt-ads-manager-mcp@latest"],
      "env": {
        "OPENAI_ADS_API_KEY": "sk-ads-...paste-your-key..."
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add chatgpt-ads-manager -- npx -y chatgpt-ads-manager-mcp@latest
# then in your config add env:
# OPENAI_ADS_API_KEY=sk-ads-...
# or: claude mcp add --env OPENAI_ADS_API_KEY=sk-ads-... chatgpt-ads-manager -- npx -y chatgpt-ads-manager-mcp@latest
```

Scope it: `--scope project` for the repo, `--scope user` for global.

### Windsurf / Cline / Continue / any `mcp.json` client

```json
{
  "mcpServers": {
    "chatgpt-ads-manager": {
      "command": "npx",
      "args": ["-y", "chatgpt-ads-manager-mcp@latest"],
      "env": {
        "OPENAI_ADS_API_KEY": "sk-ads-...paste-your-key..."
      }
    }
  }
}
```

> All examples now use `@latest` so `npx` fetches the newest published version from npm on next restart. Replace with `@0.1.0` to lock.

Remote/HTTP clients: this package is **stdio via npx** today (no hosted URL). Wrap with `mcp-remote` if you need HTTP.

---

## 3. Verify it works

Ask your agent:

> "Verify my ChatGPT Ads connection with get_ad_account, then list my campaigns."

What you should see:
- `get_ad_account` → `{ id: "adacct_...", name: "…", status: "active", timezone, currency_code }`
- `list_campaigns` → `{ data: [...] }` with `campaign_id`s for next steps

If `get_ad_account` says **401**, your key is wrong/expired — create a new one in Ads Manager. **403** means the account isn't enabled for that resource (e.g., conversions or brand updates need partner enablement).

---

## 4. What you can do — example prompts

Copy these verbatim to your agent. They show the elegant chaining this MCP is designed for.

1. **End-to-end in one call**
   > "Create a paused campaign called 'Fall Launch' with $50/day budget, then an ad group 'Prospecting' with impression bidding, then a chat_card ad titled 'Try Fall Launch' for ad group. Use create_campaign_hierarchy."

2. **Step-by-step (fine-grained)**
   > "Create a campaign 'Fall Launch' paused with daily_spend_limit_micros 50000000. Then create an ad group for that campaign named 'Prospecting' with billing_event_type impression. Then upload this image https://example.com/creative.png via upload_image and create a chat_card ad in that ad group with title 'Fall is here'."

3. **Geo-targeted campaign**
   > "Search geo for 'California' with search_geo_lookup, then create a campaign targeting those location IDs."

4. **Creative QA**
   > "List my ads, pick the most recent, and create_ad_preview for it so I can QA the iframe."

5. **Insights & reporting**
   > "Get last 30 days daily insights for this account with get_ad_account_insights, then breakdown by country. Also pull conversion insights via get_conversion_insights grouped by campaign."

6. **Audiences**
   > "Upload a CSV via upload_audience_file then create a custom audience from it, check get_custom_audience until it's ready, and show me targeting ids to use in a campaign."

7. **Conversions setup**
   > "Create a conversion pixel named 'Checkout' via create_conversion_pixel, then create a conversion API key, then create a conversion event setting for order_created linked to that pixel."

8. **Lead flow**
   > "Create a lead form with 3 required text fields, publish it, create a business agent that uses it, preview the agent, then publish the agent."

9. **Product catalog**
   > "List product feeds, query products matching brand='Acme', then patch availability for out-of-stock items."

10. **Spend control**
    > "Show spend limit windows, then create a new $10k cap for next month."

---

## 5. All tools (89)

Every tool accepts optional `ad_account_id` to override the env default (for multi-account agents). IDs flow forward: `campaign_id → ad_group_id → ad_id`, `file_id → creative`, `custom_audience_id → targeting`.

### Ad Account (12)
`get_ad_account`, `list_ad_accounts`, `update_ad_account_brand`, `update_ad_account_negative_keywords`, `activate_ad_account`, `pause_ad_account`, `get_ad_account_spend_limit_windows`, `create_ad_account_spend_limit_window`, `update_ad_account_spend_limit_window`, `delete_ad_account_spend_limit_window`, `get_oauth_me`, `create_api_key`

### Campaigns (7)
`list_campaigns`, `get_campaign`, `create_campaign`, `update_campaign`, `activate_campaign`, `pause_campaign`, `archive_campaign`

### Ad Groups (7)
`list_ad_groups`, `get_ad_group`, `create_ad_group`, `update_ad_group`, `activate_ad_group`, `pause_ad_group`, `archive_ad_group`

### Ads (8)
`list_ads`, `get_ad`, `create_ad`, `update_ad`, `create_ad_preview`, `activate_ad`, `pause_ad`, `archive_ad`

### Insights (5)
`get_ad_account_insights`, `get_campaign_insights`, `get_ad_group_insights`, `get_ad_insights`, `get_conversion_insights`

### Files / Assets (2)
`upload_image` (image_url https OR image_base64), `upload_audience_file` (CSV/TXT base64 → file_id)

### Custom Audiences (9)
`list_custom_audiences`, `create_custom_audience`, `get_custom_audience`, `archive_custom_audience`, `add_audience_members`, `remove_audience_members`, `replace_audience_members`, `merge_custom_audiences`, `get_audience_operation`

### Business Agents (7)
`list_business_agent_tools`, `list_business_agents`, `create_business_agent`, `get_business_agent`, `update_business_agent`, `preview_business_agent`, `publish_business_agent`

### Lead Forms (7)
`list_lead_forms`, `create_lead_form`, `get_lead_form`, `update_lead_form`, `publish_lead_form`, `archive_lead_form`, `create_test_lead_submission`

### Lead Sync (4)
`create_lead_sync_subscription`, `list_lead_sync_subscriptions`, `get_lead_sync_subscription`, `delete_lead_sync_subscription`

### Conversions Setup (6)
`create_conversion_pixel`, `list_conversion_pixels`, `create_conversion_api_key`, `create_conversion_event_setting`, `list_conversion_event_settings`, `list_conversion_events`

### Product Feeds (10)
`create_product_feed`, `list_product_feeds`, `archive_product_feed`, `list_product_feed_uploads`, `query_product_feed_products`, `patch_product_feed_products`, `get_product_feed_sftp_access`, `create_product_feed_sftp_access`, `activate_product_feed_sftp_access`, `pause_product_feed_sftp_access`

### Geo & Partner (3)
`search_geo_lookup`, `create_partner_data_upload`, `get_partner_data_upload`

### Workflows (2)
`create_campaign_hierarchy` (campaign → ad_group → ad in one chained call), `poll_audience_operation` (check audience mutation status; call repeatedly with backoff)

**Coming in v2:** Bulk mutation jobs (`/bulk_mutation_jobs`) and server-side conversions event ingestion to `bzr.openai.com` (create pixel → send events end-to-end).

---

## 6. How chaining works

The MCP is built so an agent never has to guess IDs.

1. **Discover** → `list_campaigns`, `list_ad_groups`, `list_ads`, `search_geo_lookup`, `list_custom_audiences`
2. **Create** → `create_campaign` returns `campaign_id`; feed it to `create_ad_group` → returns `ad_group_id` → feed to `create_ad`
3. **Activate** → `activate_campaign` / `activate_ad_group` / `activate_ad` (all must be active + ad `review_status: approved` to serve)
4. **Measure** → `get_*_insights` / `get_conversion_insights` with `time_ranges`, `segments` (`product`, `country`, `device`), `fields`
5. **Paginate** → every `list_*` + `get_*_insights` supports `limit` / `after` / `before` / `order`. Use `has_more` + `first_id` / `last_id` from the response for the next page. Never invent a cursor — use the one returned.

Tip: `create_campaign_hierarchy` bundles steps 2–3 when you want speed; use atomic `create_*` tools when you need per-resource control (different bidding configs, product_sets, etc.).

---

## 7. Multi-account & env options

| Env var | Purpose | Default |
|---|---|---|
| `OPENAI_ADS_API_KEY` | Advertiser API key (primary) | — (required) |
| `CHATGPT_ADS_API_KEY` | Alias fallback | — |
| `OPENAI_AD_ACCOUNT_ID` | Default ad account for `OpenAI-Ad-Account` header | — |
| `OPENAI_ADS_BASE_URL` | Override API base (e.g., local mock) | `https://api.ads.openai.com/v1` |

- If **both** `OPENAI_ADS_API_KEY` and `CHATGPT_ADS_API_KEY` are set, `OPENAI_...` wins.
- Per-call `ad_account_id` param wins over the env — use it for partner/agency flows that juggle many accounts.
- OAuth/shared keys *require* `ad_account_id` or `OPENAI_AD_ACCOUNT_ID` per request; advertiser keys can omit it (header must match the key's account if set).

---

## 8. Troubleshooting

- **401** `Ads API ... failed: 401` → key missing/invalid/expired. Regenerate at Ads Manager > Settings > API Keys, then restart your agent.
- **403** → operation not enabled for this ad account (common for conversions, brand updates, business agents). Contact your OpenAI partner representative.
- **429** `Rate limited. Retry-After: ...` → backs off automatically. The API enforces 600 req/min per endpoint and 1200 overall. Wait for `Retry-After` then retry.
- **Tool "Missing Advertiser API key"** → you set the key in the wrong config file or forgot to restart. Copy the exact `env` block from §2; keep JSON valid (no trailing commas).
- **Upload stuck / audience `processing`** → `get_custom_audience` / `get_audience_operation` are async. Poll with backoff; `get_partner_data_upload` similarly.
- **`custom_audience_operation_recovery_required (409)`** → resend the same body + same `idempotency_key`.
- **`review_status: pending`** after `create_ad` → normal; reviews take minutes. Monitor with `get_ad`.
- **Still stuck?** Open an issue: `https://github.com/anomalyco/chatgpt-ads-manager-mcp/issues` with the tool name + error text (never paste your full key).

---

## 9. Security & privacy

- Your API key **never leaves your machine** — the MCP `fetch` calls `api.ads.openai.com` directly from your local `npx` process. No proxy, no telemetry.
- **Never log/commit** your key. If you use project-scoped `.cursor/mcp.json`, use `${OPENAI_ADS_API_KEY}` placeholder in git and keep the real key in your global `~/.cursor/mcp.json`.
- **SSRF-guarded:** `image_url` / `target_url` / `url` params are checked for `https:` only, block private hosts (`localhost`, `10/8`, `192.168/16`, `172.16/12`, `169.254/16`, `fc00::/7`), block `file:`/`javascript:`/`data:` schemes, cap length, and enforce timeouts. Private-app data can't be exfiltrated via a crafted URL.
- **No `exec` or `shell`** — file uploads are base64-encoded and sent as multipart `FormData`; no shell interpolation.
- **Rate-limit aware** — respects `Retry-After` instead of hammering the API.
- **PII-safe:** all upstream data is returned as JSON `data`, never as injected instructions. The MCP doesn't interpret page content as commands.

Report a security issue: please open a private issue or contact the maintainer — don't publish keys in bug reports.

---

## 10. Developing / contributing

This section is for **contributors only** — you don't need it to *use* the MCP.

```bash
git clone https://github.com/anomalyco/chatgpt-ads-manager-mcp
cd chatgpt-ads-manager-mcp
npm install
npm run build        # tsc -> dist/
npm run inspect      # MCP Inspector (requires OPENAI_ADS_API_KEY not set — still lists tools)
# or with inspector mock:
OPENAI_ADS_API_KEY=sk-ads-test npx -y @modelcontextprotocol/inspector node dist/index.js
```

**Test pattern:**

```bash
# Mock server in another terminal:
OPENAI_ADS_API_KEY=sk-ads-test OPENAI_ADS_BASE_URL=http://localhost:17892/v1 npx -y chatgpt-ads-manager-mcp
# Then via Inspector: initialize -> tools/list -> tools/call get_ad_account
```

Publish (maintainers):

```bash
npm run build
npm pack --dry-run   # check 87 files, ~42kB
npm publish --access public   # no --provenance for manual publish; use --provenance only in GitHub Actions OIDC
# bump version first: npm version patch && npm publish --access public && git push --follow-tags
```

API docs: `https://developers.openai.com/ads/api-overview` + `https://developers.openai.com/ads/openapi.json`.

License: MIT.

