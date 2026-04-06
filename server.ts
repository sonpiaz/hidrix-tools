/**
 * Hidrix Tools — MCP Server
 *
 * Auto-discovers tools from the tools directory and registers them.
 * To add a new tool: create tools/your-tool/index.ts and export `definition`.
 *
 * Usage:
 *   bun run server.ts          # stdio transport (default)
 *   bun run server.ts --http   # Streamable HTTP transport (port 3100)
 *   PORT=8080 bun run server.ts --http  # custom port
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadTools, checkEnvVars } from "./lib/tool-registry.js";
import { join } from "path";

const VERSION = "2.0.0";
const DEFAULT_HTTP_PORT = 3100;

function createServer(): McpServer {
  return new McpServer({
    name: "hidrix-tools",
    version: VERSION,
  });
}

async function registerTools(server: McpServer) {
  const toolsDir = join(import.meta.dir, "tools");
  const tools = await loadTools(toolsDir);
  let registered = 0;

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
    registered++;
  }

  console.error(`[hidrix-tools] ${registered}/${tools.length} tools loaded`);
  return registered;
}

async function startStdio(server: McpServer) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[hidrix-tools] MCP server running on stdio");
}

async function startHttp(server: McpServer) {
  const { createServer: createHttpServer } = await import("http");
  const port = parseInt(process.env.PORT || String(DEFAULT_HTTP_PORT));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });

  await server.connect(transport);

  const httpServer = createHttpServer(async (req, res) => {
    const url = req.url || "/";

    if (url === "/mcp" && (req.method === "POST" || req.method === "GET" || req.method === "DELETE")) {
      // Parse body for POST
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        await transport.handleRequest(req, res, body);
      } else {
        await transport.handleRequest(req, res);
      }
      return;
    }

    if (url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: VERSION }));
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  httpServer.listen(port, () => {
    console.error(`[hidrix-tools] MCP server running on http://localhost:${port}/mcp`);
    console.error(`[hidrix-tools] Health check: http://localhost:${port}/health`);
  });
}

async function main() {
  const useHttp = process.argv.includes("--http");
  const server = createServer();

  await registerTools(server);

  if (useHttp) {
    await startHttp(server);
  } else {
    await startStdio(server);
  }
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
