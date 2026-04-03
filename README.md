# hidrix-tools

Standalone MCP server with web search, social media search, and web fetch tools. Works with Claude Code, Pi agent, OpenClaw, or any MCP client.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Bun-black.svg)](https://bun.sh/)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io/)

## Tools

| Tool | Source | Description |
|------|--------|-------------|
| `web_search` | Brave Search | Web search with titles, URLs, descriptions |
| `web_fetch` | Mozilla Readability | Fetch any URL → clean markdown |
| `x_search` | RapidAPI | Search X/Twitter posts |
| `reddit_search` | RapidAPI | Search Reddit posts and comments |
| `youtube_search` | RapidAPI | Search YouTube videos |
| `tiktok_search` | RapidAPI | Search TikTok videos |
| `similarweb` | RapidAPI | Website traffic analytics |

## Install

```bash
git clone https://github.com/sonpiaz/hidrix-tools.git
cd hidrix-tools
bun install
```

## Setup

Copy the example env and add your API keys:

```bash
cp .env.example .env
```

```env
BRAVE_API_KEY=your-brave-search-key        # Free: https://api.search.brave.com
RAPIDAPI_KEY=your-rapidapi-key             # https://rapidapi.com
SIMILAR_WEB_RAPIDAPI_KEY=your-key          # Separate key for SimilarWeb
```

## Usage

### With Claude Code

Add to `~/.claude/settings.json`:

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

### With Pi agent

Add to pi's MCP config — same format as Claude Code.

### Standalone

```bash
bun run server.ts
```

## API Keys

| Key | Free Tier | Get it |
|-----|-----------|--------|
| Brave Search | 2,000 queries/month | [api.search.brave.com](https://api.search.brave.com) |
| RapidAPI | Varies by API | [rapidapi.com](https://rapidapi.com) |

## Project Structure

```
hidrix-tools/
├── server.ts              — MCP server entry point
├── tools/
│   ├── web-search.ts      — Brave Search
│   ├── web-fetch.ts       — URL → markdown (Readability)
│   ├── x-search.ts        — X/Twitter search
│   ├── reddit-search.ts   — Reddit search
│   ├── youtube-search.ts  — YouTube search
│   ├── tiktok-search.ts   — TikTok search
│   └── similarweb.ts      — Traffic analytics
└── lib/
    ├── rapidapi.ts        — Shared RapidAPI client
    └── readability.ts     — HTML → markdown extraction
```

## Related

- [affiliate-skills](https://github.com/Affitor/affiliate-skills) — 45 AI agent skills for affiliate marketing
- [evox](https://github.com/sonpiaz/evox) — Multi-agent orchestration system
- [Kapt](https://github.com/sonpiaz/kapt) — macOS screenshot tool
- [Yap](https://github.com/sonpiaz/yap) — macOS push-to-talk dictation

## License

[MIT](LICENSE) — Son Piaz
