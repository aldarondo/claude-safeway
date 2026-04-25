# claude-safeway ROADMAP

## [Human] Prerequisites
- [ ] Copy `.env.example` to `.env` and fill in SAFEWAY_EMAIL, SAFEWAY_PASSWORD
- [ ] Run `npm install`
- [ ] Use `find_stores` tool to look up your store ID, set SAFEWAY_STORE_ID in .env

## [Code] ✅ Completed — 2026-04-19
- [x] `src/auth.js` — login(), refreshAccessToken()
- [x] `src/api.js` — findStores(), searchProducts(), getWeeklyAd(), addToCart()
- [x] `src/index.js` — MCP server with 4 tools, lazy login, auto-refresh
- [x] package.json, .gitignore, .env.example, CLAUDE.md

## [Code] ✅ Completed — 2026-04-19
- [x] SSE transport pattern: src/server.js (factory), src/index.js (stdio), src/serve.js (SSE on port 8773), docker-compose.yml, unit tests (8 passing)
- [x] 2026-04-19 — Deployed to Synology NAS (port 8773); container running — blocked on Safeway credentials in `.env`

## Backlog

### Build & Infrastructure
- [x] `[Code]` 2026-04-23 — Add GHCR build-push workflow — migrate container from `node:20-alpine` to a versioned GHCR image (`ghcr.io/aldarondo/...`) with GitHub Actions auto-deploy
- [x] `[Code]` 2026-04-23 — Add weekly scheduled rebuild — GitHub Actions `schedule: cron` to repull and push a fresh image every week, picking up base-image security patches

- [ ] Verify actual API response shapes (may need tweaks after first live test)
- [ ] `view_cart` tool — GET current cart contents
- [ ] `get_just4u_deals` tool — personalized J4U coupon offers
- [ ] `clip_coupon` tool — clip a J4U digital coupon
- [ ] Store the storeId preference per-session rather than requiring env var every time
- [ ] Rate limiting / retry logic for 429 responses

## ✅ Completed
- [2026-04-23] GHCR build-push workflow and weekly scheduled rebuild added to `.github/workflows/build.yml`; Dockerfile on `node:22-alpine`

## 🚫 Blocked

- ❌ [docker-monitor:no-ghcr-image] Container `claude-safeway` uses `node:20-alpine` — migrate to `ghcr.io/aldarondo/...` with a GitHub Actions build-push workflow — 2026-04-23 08:00 UTC

