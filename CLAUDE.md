# claude-safeway

## What this is
MCP server for Safeway/Albertsons online grocery. Uses the **unofficial Safeway web API** — the same endpoints the Safeway.com website calls in the browser, reverse-engineered by the community.

## Disclaimer
This is an **unofficial** API integration. Safeway has no public developer API. These endpoints may change without notice and their use may violate Safeway's Terms of Service. Use for personal automation only.

## Setup

```bash
# 1. Install dependencies (no extra browser required — pure HTTP)
npm install

# 2. Copy and fill in credentials
cp .env.example .env
# Edit .env with your Safeway.com login email + password
```

## Finding your Store ID
```
Use the find_stores tool with your ZIP code, then copy the storeId into SAFEWAY_STORE_ID in .env.
```

## Connecting to Claude Desktop
Add to `~/AppData/Roaming/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "safeway": {
      "command": "node",
      "args": ["C:/Users/Aldarondo Family/Documents/Github/claude-safeway/src/index.js"],
      "env": {
        "SAFEWAY_EMAIL": "you@example.com",
        "SAFEWAY_PASSWORD": "yourpassword",
        "SAFEWAY_STORE_ID": "3132"
      }
    }
  }
}
```

Alternatively, load env from a `.env` file using a wrapper script.

## Tools exposed
| Tool | Args | Description |
|------|------|-------------|
| `find_stores` | zip_code | Find nearby Safeway/Albertsons (public, no auth) |
| `search_products` | query, store_id? | Search product catalog |
| `get_weekly_deals` | store_id? | Current weekly ad deals |
| `add_to_cart` | items[], store_id? | Add items to online cart |

## Auth flow
- Credentials are read from env vars at startup.
- Login happens lazily on first authenticated tool call.
- Token is refreshed automatically when it expires.
- No credentials are stored on disk — only held in memory.

## Known limitations
- The weekly ad and cart endpoints are the least stable — Safeway may change them.
- Safeway's cart is separate from in-store purchases; you must complete checkout at safeway.com.
