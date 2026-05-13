# Agent Integrations

hidrix-tools supports two MCP transports and a native Pi extension.

## Transports

| Mode | Command | Use Case |
|---|---|---|
| **stdio** (default) | `bun run server.ts` | Local agent, spawned as subprocess |
| **Streamable HTTP** | `bun run server.ts --http` | Remote/shared server, multiple agents |

HTTP runs on port 3100 by default (`PORT=8080` to override).
Endpoint: `POST /mcp`, Health: `GET /health`.

## Agent Configs

Config templates are in `integrations/<agent>/`. Copy the relevant snippet into your agent's config.

### Claude Code / Claude Desktop

Copy `.mcp.json` to your project root, or add to `~/.claude/settings.local.json`:

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

### Cursor

Add to `~/.cursor/mcp.json` or project `.cursor/mcp.json`:

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

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

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

### OpenClaw / EVOX.sh

Add to `openclaw.json` or `evox.json`:

```json
{
  "mcp": {
    "servers": {
      "hidrix-tools": {
        "command": "bun",
        "args": ["run", "/path/to/hidrix-tools/server.ts"],
        "transport": "stdio"
      }
    }
  }
}
```

### Hermes

Add to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  hidrix-tools:
    command: bun
    args:
      - run
      - /path/to/hidrix-tools/server.ts
```

For native Hermes Agent X/Twitter automation, you can run
[Hermes Tweet](https://github.com/Xquik-dev/hermes-tweet) beside hidrix-tools:

```bash
hermes plugins install Xquik-dev/hermes-tweet --enable
```

Set `XQUIK_API_KEY` in your Hermes environment. Keep hidrix-tools connected for
web, Reddit, YouTube, TikTok, LinkedIn, and multi-source MCP research. Use
Hermes Tweet when the workflow needs to scrape/search tweets, search Twitter/X,
read tweet replies, look up users, monitor tweets, export followers, or perform
confirmation-gated post tweets/replies, send DMs, and automate X actions.

### Pi Agent (native extension, no MCP)

Pi does not support MCP. Use the native extension bridge:

```bash
cp -r integrations/pi-extension ~/.pi/agent/extensions/hidrix-tools
```

Then `/reload` in Pi. Tools are available as `hidrix_web_search`, `hidrix_x_search`, etc.

## HTTP Transport (remote access)

For remote or multi-agent setups:

```bash
# Start server
bun run server.ts --http

# Or with custom port
PORT=8080 bun run server.ts --http
```

Agents connect via Streamable HTTP transport to `http://host:3100/mcp`.
