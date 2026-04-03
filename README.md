<h1 align="center">hidrix-tools</h1>

<p align="center">
  MCP server with web search, social media search, and web fetch tools for any AI agent.
</p>

<p align="center">
  <a href="https://github.com/sonpiaz/hidrix-tools/blob/main/LICENSE"><img src="https://img.shields.io/github/license/sonpiaz/hidrix-tools" alt="License" /></a>
  <a href="https://github.com/sonpiaz/hidrix-tools/stargazers"><img src="https://img.shields.io/github/stars/sonpiaz/hidrix-tools" alt="Stars" /></a>
  <img src="https://img.shields.io/badge/MCP-compatible-purple" alt="MCP" />
  <img src="https://img.shields.io/badge/Bun-TypeScript-black" alt="Bun" />
</p>

---

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

### Quick setup (Claude Code)

```bash
git clone https://github.com/sonpiaz/hidrix-tools.git ~/.hidrix-tools
cd ~/.hidrix-tools && bun install && cp .env.example .env
# Add your API keys to .env
```

Then add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "hidrix-tools": {
      "command": "bun",
      "args": ["run", "~/.hidrix-tools/server.ts"]
    }
  }
}
```

Works with Pi agent, OpenClaw, or any MCP client — same config format.

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

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| [Bun](https://bun.sh/) | Runtime |
| [TypeScript](https://typescriptlang.org/) | Language |
| [MCP SDK](https://modelcontextprotocol.io/) | Agent protocol |
| [Brave Search](https://brave.com/search/api/) | Web search |
| [Mozilla Readability](https://github.com/mozilla/readability) | Content extraction |

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Related

- [affiliate-skills](https://github.com/Affitor/affiliate-skills) — 45 AI agent skills
- [content-pipeline](https://github.com/Affitor/content-pipeline) — AI-powered LinkedIn content generation
- [Kapt](https://github.com/sonpiaz/kapt) — macOS screenshot tool with annotation & OCR
- [Yap](https://github.com/sonpiaz/yap) — Push-to-talk dictation for macOS

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">Built by <a href="https://github.com/sonpiaz">Son Piaz</a></p>
