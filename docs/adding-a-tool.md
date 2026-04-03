# Adding a Tool

Add a new tool to hidrix-tools in 3 steps. No changes to `server.ts` needed — tools are auto-discovered.

## 1. Create the directory

```bash
cp -r tools/_template tools/your-tool-name
```

## 2. Edit `tools/your-tool-name/index.ts`

```typescript
import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";

async function execute({ query }: { query: string }): Promise<string> {
  // Call your API, format results as markdown
  const response = await fetch(`https://api.example.com/search?q=${query}`);
  const data = await response.json();
  return data.results.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}`).join("\n\n");
}

export const definition: ToolDefinition = {
  name: "example_search",           // MCP tool name (snake_case)
  description: "Search example.com", // Shown to AI agents
  params: {
    query: z.string().describe("Search query"),
  },
  envVars: ["EXAMPLE_API_KEY"],      // Checked at startup, tool skipped if missing
  execute,
};
```

## 3. Test

```bash
bun run server.ts
# Should see: [hidrix-tools] ✓ example_search
```

## Rules

- **One tool per directory** — `tools/your-tool/index.ts`
- **Export `definition`** — must conform to `ToolDefinition` interface
- **Return markdown** — AI agents render it for users
- **Handle errors** — throw on failure, the server wraps it
- **Declare env vars** — list in `envVars[]` so the server skips gracefully when keys are missing
- **No server.ts edits** — auto-discovery handles registration

## Checklist before PR

- [ ] Tool works: `bun run server.ts` shows ✓
- [ ] Returns clean markdown output
- [ ] `envVars` lists all required environment variables
- [ ] Added tool to the table in `README.md`
- [ ] Added env vars to `.env.example` with comment

## Tool Ideas

Looking for inspiration? These tools would be great additions:

- **github_search** — Search GitHub repos, issues, code
- **hackernews_search** — Search Hacker News stories and comments
- **producthunt_search** — Search Product Hunt launches
- **arxiv_search** — Search academic papers
- **linkedin_search** — Search LinkedIn posts and profiles
- **google_trends** — Trending topics and interest over time
- **whois_lookup** — Domain registration info
- **dns_lookup** — DNS records for a domain
