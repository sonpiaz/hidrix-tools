<h1 align="center">hidrix-tools</h1>

<p align="center">
  MCP tool server that gives any AI agent the ability to search, scrape, and analyze content across the internet.
</p>

<p align="center">
  <a href="https://github.com/sonpiaz/hidrix-tools/blob/main/LICENSE"><img src="https://img.shields.io/github/license/sonpiaz/hidrix-tools" alt="License" /></a>
  <a href="https://github.com/sonpiaz/hidrix-tools/stargazers"><img src="https://img.shields.io/github/stars/sonpiaz/hidrix-tools" alt="Stars" /></a>
  <img src="https://img.shields.io/badge/MCP-compatible-purple" alt="MCP" />
  <img src="https://img.shields.io/badge/Bun-TypeScript-black" alt="Bun" />
</p>

---

## What is hidrix-tools?

AI agents like Claude, OpenClaw, Hermes, Cursor, and pi can read files and write code — but they can't search the web, read social media, or scrape data on their own.

**hidrix-tools fixes that.** It's an [MCP](https://modelcontextprotocol.io/) server that provides tools for web search, social media search, Facebook scraping, content analysis, and more. Plug it into any agent that supports MCP — no vendor lock-in.

```
Your AI Agent                    hidrix-tools                     Internet
┌──────────┐     MCP protocol    ┌──────────────┐                ┌─────────┐
│ Claude   │ ◄─────────────────► │ web_search   │ ◄────────────► │ Brave   │
│ OpenClaw │                     │ x_search     │                │ X/Twitter│
│ Hermes   │                     │ reddit_search│                │ Reddit  │
│ Cursor   │                     │ facebook_    │                │ Facebook│
│ pi       │                     │   scraper    │                │ YouTube │
│ Codex    │                     │ content_     │                │ TikTok  │
│ ...      │                     │   scorer     │                │ Meta Ads│
└──────────┘                     └──────────────┘                └─────────┘
```

## Why use hidrix-tools?

| Without hidrix-tools | With hidrix-tools |
|---|---|
| Agent can only read local files | Agent can search web, read articles, scrape social media |
| "I don't have access to the internet" | "Here are the top 10 Reddit posts about your topic this week" |
| Manual copy-paste research | Agent autonomously gathers data from 7+ platforms |
| No competitive intelligence | Agent scrapes competitor FB pages, analyzes engagement patterns |
| One platform at a time | Cross-platform research in a single conversation |

## Compatible agents

| Agent / Platform | Setup | Status |
|---|---|---|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) / Claude Desktop | `settings.json` → mcpServers | ✅ Tested |
| [pi](https://github.com/mariozechner/pi-coding-agent) | Native extension (no MCP) | ✅ Tested |
| [OpenClaw](https://github.com/openclaw/openclaw) | `openclaw.json` → mcp_servers | ✅ Compatible |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | `config.yaml` → mcp_servers | ✅ Compatible |
| [Cursor](https://cursor.sh) | MCP settings | ✅ Compatible |
| [Codex CLI](https://github.com/openai/codex) | MCP config | ✅ Compatible |
| Any MCP client | stdio transport | ✅ |

## Tools

### Search

| Tool | Source | What it does |
|------|--------|-------------|
| `web_search` | Brave Search | Search the web — titles, URLs, descriptions |
| `x_search` | GetXAPI / RapidAPI | Search X/Twitter with engagement data (likes, retweets, views) |
| `x_thread_reader` | GetXAPI | Read full X threads, articles, and tweet replies |
| `x_user_posts` | GetXAPI | Get recent posts from a specific X user with engagement |
| `reddit_search` | RapidAPI | Search Reddit with full text and engagement data |
| `reddit_thread_reader` | Reddit JSON API (free) | Read full post + comment tree |
| `reddit_subreddit_top` | Reddit JSON API (free) | Top posts from any subreddit by time range |
| `youtube_search` | RapidAPI | Search YouTube videos |
| `tiktok_search` | RapidAPI | Search TikTok videos |

### Scrape & Fetch

| Tool | Source | What it does |
|------|--------|-------------|
| `web_fetch` | Mozilla Readability | Fetch any URL → clean readable markdown |
| `facebook_scraper` | Apify + Meta API | Scrape FB groups, pages, keyword search, or Meta Ad Library |

### Analyze

| Tool | Source | What it does |
|------|--------|-------------|
| `content_scorer` | Built-in | Score and rank posts by weighted engagement + time-decay |
| `content_analyzer` | Built-in | Topic clusters, content patterns, timing trends, author leaderboard |

### LinkedIn

| Tool | Source | What it does |
|------|--------|-------------|
| `linkedin_search` | Apify (no login) | Search LinkedIn posts by keyword with engagement data |
| `linkedin_profile` | Apify (no login) | Get recent posts from a LinkedIn profile |

### Intel

| Tool | Source | What it does |
|------|--------|-------------|
| `similarweb` | RapidAPI | Website traffic, rank, engagement analytics |

### Storage & Automation

| Tool | Source | What it does |
|------|--------|-------------|
| `data_store` | SQLite (built-in) | Save/query scraped posts, dedup, run history, storage stats |

## Real-world use cases

### 🔍 Research agent
> "Find top 10 posts about AI agents on Reddit this week, compare with X/Twitter, summarize the trends"

Agent uses: `reddit_search` → `x_search` → `content_analyzer`

### 📊 Content pipeline
> "Scrape 5 Facebook groups about marketing VN, rank top 100 posts by engagement, analyze patterns"

Agent uses: `facebook_scraper` (group mode) → `content_scorer` → `content_analyzer`

### 🕵️ Competitive intelligence
> "What ads is competitor X running on Facebook? What's their messaging strategy?"

Agent uses: `facebook_scraper` (ads mode) → Meta Ad Library API (free)

### 📰 Article research
> "Read these 5 articles and summarize the key insights"

Agent uses: `web_fetch` (for each URL)

### 📈 Market research
> "What are people saying about product X across Reddit, X, and YouTube?"

Agent uses: `reddit_search` + `x_search` + `youtube_search` → `content_analyzer`

### 🏆 Top content discovery
> "Find the most viral posts in this Facebook group this month"

Agent uses: `facebook_scraper` → `content_scorer` (sort by engagement)

## Install

### Quick setup

```bash
git clone https://github.com/sonpiaz/hidrix-tools.git ~/.hidrix-tools
cd ~/.hidrix-tools && bun install && cp .env.example .env
# Add your API keys to .env
```

### Connect to your agent

**Claude Code** — add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "hidrix-tools": {
      "command": "bun",
      "args": ["run", "/path/to/hidrix-tools/server.ts"]
    }
  }
}
```

**OpenClaw** — add to `openclaw.json`:

```yaml
mcp_servers:
  hidrix-tools:
    command: "bun"
    args: ["run", "/path/to/hidrix-tools/server.ts"]
```

**Hermes Agent** — add to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  hidrix-tools:
    command: "bun"
    args: ["run", "/path/to/hidrix-tools/server.ts"]
```

**pi (coding agent)** — copy extension:

```bash
cp -r integrations/pi-extension ~/.pi/agent/extensions/hidrix-tools
# Then /reload in pi
```

See [integrations/pi-extension/README.md](integrations/pi-extension/README.md) for details.

**Standalone** (any MCP client):

```bash
bun run server.ts
```

## API Keys

Tools are auto-skipped if their API keys are missing — only configure what you need.

| Key | Tools | Free Tier | Get it |
|-----|-------|-----------|--------|
| `BRAVE_API_KEY` | web_search | 2,000 queries/month | [api.search.brave.com](https://api.search.brave.com) |
| `GETXAPI_KEY` | x_search, x_thread_reader, x_user_posts | $0.001/call, no subscription | [getxapi.com](https://getxapi.com) |
| `RAPIDAPI_KEY` | x_search (fallback), reddit_search, youtube_search, tiktok_search | Varies | [rapidapi.com](https://rapidapi.com) |
| `APIFY_API_TOKEN` | facebook_scraper (group/page/search) | $5/month credit | [console.apify.com](https://console.apify.com/settings/integrations) |
| `META_ADS_ACCESS_TOKEN` | facebook_scraper (ads mode) | Free, unlimited | [facebook.com/ads/library/api](https://www.facebook.com/ads/library/api/) |

## Add your own tool

Tools are auto-discovered — no changes to `server.ts` needed.

```bash
cp -r tools/_template tools/your-tool-name
# Edit tools/your-tool-name/index.ts
bun run server.ts
# [hidrix-tools] ✓ your_tool_name
```

See [docs/adding-a-tool.md](docs/adding-a-tool.md) for the full guide.

## Project structure

```
hidrix-tools/
├── server.ts                  — MCP server, auto-discovers tools
├── tools/
│   ├── _template/             — Copy this to create a new tool
│   ├── web-search/            — Brave Search
│   ├── web-fetch/             — URL → markdown
│   ├── x-search/              — X/Twitter search (GetXAPI + RapidAPI fallback)
│   ├── x-thread-reader/       — Read X threads & articles
│   ├── x-user-posts/          — User timeline with engagement
│   ├── reddit-search/         — Reddit search (upgraded)
│   ├── reddit-thread-reader/  — Full post + comment tree (free API)
│   ├── reddit-subreddit-top/  — Subreddit top posts (free API)
│   ├── youtube-search/        — YouTube search
│   ├── tiktok-search/         — TikTok search
│   ├── similarweb/            — Traffic analytics
│   ├── facebook-scraper/      — FB groups, pages, search, ads
│   ├── content-scorer/        — Engagement scoring + ranking
│   └── content-analyzer/      — Topic/pattern/trend analysis
├── lib/
│   ├── tool-registry.ts       — Auto-discovery engine
│   ├── rapidapi.ts            — Shared RapidAPI client
│   ├── getxapi.ts             — GetXAPI client (X/Twitter)
│   ├── apify.ts               — Apify REST client
│   ├── meta-ads.ts            — Meta Ad Library API client
│   └── readability.ts         — HTML → markdown extraction
└── docs/
    ├── adding-a-tool.md       — Tool authoring guide
    ├── feedback-and-bug-reporting.md — Bug reporting standards
    ├── known-issues.md        — Tracked limitations
    └── ROADMAP.md             — Development roadmap
```

## Docs

| Doc | Description |
|-----|-------------|
| [Adding a tool](docs/adding-a-tool.md) | How to create a new tool |
| [Feedback & bug reporting](docs/feedback-and-bug-reporting.md) | Standards for detecting and reporting issues |
| [Known issues](docs/known-issues.md) | Tracked provider limitations and quirks |
| [Roadmap](docs/ROADMAP.md) | Development roadmap (X upgrade, Reddit upgrade, LinkedIn, extensions) |

## Tech stack

| Technology | Purpose |
|-----------|---------|
| [Bun](https://bun.sh/) | Runtime |
| [TypeScript](https://typescriptlang.org/) | Language |
| [MCP SDK](https://modelcontextprotocol.io/) | Agent protocol |
| [Brave Search](https://brave.com/search/api/) | Web search |
| [Mozilla Readability](https://github.com/mozilla/readability) | Content extraction |
| [Apify](https://apify.com/) | Facebook scraping |
| [Meta Ad Library API](https://www.facebook.com/ads/library/api/) | Ad intelligence (free) |

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

When reporting bugs, follow [docs/feedback-and-bug-reporting.md](docs/feedback-and-bug-reporting.md).

## Related

- [affiliate-skills](https://github.com/Affitor/affiliate-skills) — 45 AI agent skills
- [content-pipeline](https://github.com/Affitor/content-pipeline) — AI-powered LinkedIn content generation
- [Kapt](https://github.com/sonpiaz/kapt) — macOS screenshot tool with annotation & OCR
- [Yap](https://github.com/sonpiaz/yap) — Push-to-talk dictation for macOS

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">Built by <a href="https://github.com/sonpiaz">Son Piaz</a></p>
