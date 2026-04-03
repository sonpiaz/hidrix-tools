/**
 * Tool Template — Copy this directory to create a new tool.
 *
 * Steps:
 *   1. cp -r tools/_template tools/your-tool-name
 *   2. Edit index.ts — change name, description, params, execute
 *   3. Run `bun run server.ts` — auto-discovered
 *   4. Submit a PR
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";

async function execute({ query }: { query: string }): Promise<string> {
  // Your tool logic here
  // Return markdown-formatted string
  return `Results for: ${query}`;
}

export const definition: ToolDefinition = {
  name: "your_tool_name",
  description: "One-line description of what this tool does.",
  params: {
    query: z.string().describe("Search query"),
  },
  envVars: ["YOUR_API_KEY"], // Remove if no env vars needed
  execute,
};
