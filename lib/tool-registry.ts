/**
 * Tool Registry — Auto-discovers and registers tools from the tools/ directory.
 *
 * To add a new tool:
 *   1. Create tools/your-tool/index.ts
 *   2. Export a `definition` object conforming to ToolDefinition
 *   3. Done — the server auto-discovers it on startup
 */

import { z } from "zod";

export interface ToolDefinition {
  /** Tool name used in MCP (e.g. "web_search") */
  name: string;

  /** Human-readable description shown to AI agents */
  description: string;

  /** Zod schema for tool parameters */
  params: Record<string, z.ZodTypeAny>;

  /** Execute the tool. Returns markdown string. */
  execute: (params: Record<string, any>) => Promise<string>;

  /** Environment variables required (checked at startup) */
  envVars?: string[];
}

/**
 * Load all tools from the tools/ directory.
 * Each tool must be a directory with an index.ts exporting `definition`.
 */
export async function loadTools(toolsDir: string): Promise<ToolDefinition[]> {
  const { readdirSync, statSync } = await import("fs");
  const { join } = await import("path");

  const tools: ToolDefinition[] = [];
  const entries = readdirSync(toolsDir);

  for (const entry of entries) {
    if (entry.startsWith("_")) continue; // Skip _template etc.
    const fullPath = join(toolsDir, entry);

    // Support both tools/name/index.ts (new) and tools/name.ts (legacy)
    let modulePath: string | null = null;

    if (statSync(fullPath).isDirectory()) {
      const indexPath = join(fullPath, "index.ts");
      try {
        statSync(indexPath);
        modulePath = indexPath;
      } catch {
        continue; // No index.ts, skip
      }
    } else if (entry.endsWith(".ts") && entry !== "index.ts") {
      // Legacy single-file tools — skip, handled by server.ts directly
      continue;
    }

    if (!modulePath) continue;

    try {
      const mod = await import(modulePath);
      if (mod.definition && mod.definition.name && mod.definition.execute) {
        tools.push(mod.definition);
      } else {
        console.error(`[hidrix-tools] ${entry}: missing 'definition' export, skipping`);
      }
    } catch (e: any) {
      console.error(`[hidrix-tools] ${entry}: failed to load — ${e.message}`);
    }
  }

  return tools;
}

/**
 * Check if required env vars are set for a tool.
 * Returns list of missing vars (empty = all good).
 */
export function checkEnvVars(tool: ToolDefinition): string[] {
  if (!tool.envVars) return [];
  return tool.envVars.filter((v) => !process.env[v]);
}
