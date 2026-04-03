/**
 * Hidrix Tools — MCP Server
 *
 * Auto-discovers tools from the tools directory and registers them.
 * To add a new tool: create tools/your-tool/index.ts and export `definition`.
 *
 * Usage:
 *   bun run server.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadTools, checkEnvVars } from "./lib/tool-registry.js";
import { join } from "path";

const server = new McpServer({
  name: "hidrix-tools",
  version: "2.0.0",
});

async function main() {
  // Auto-discover tools
  const toolsDir = join(import.meta.dir, "tools");
  const tools = await loadTools(toolsDir);

  // Register each tool
  for (const tool of tools) {
    const missing = checkEnvVars(tool);
    if (missing.length > 0) {
      console.error(`[hidrix-tools] ${tool.name}: skipped (missing env: ${missing.join(", ")})`);
      continue;
    }

    server.tool(
      tool.name,
      tool.description,
      tool.params,
      async (params: Record<string, any>) => {
        try {
          const result = await tool.execute(params);
          return { content: [{ type: "text" as const, text: result }] };
        } catch (e: any) {
          return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
        }
      },
    );

    console.error(`[hidrix-tools] ✓ ${tool.name}`);
  }

  console.error(`[hidrix-tools] ${tools.length} tools loaded`);

  // Start
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[hidrix-tools] MCP server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
