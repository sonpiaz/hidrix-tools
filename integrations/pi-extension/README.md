# hidrix-tools Pi Extension

Bridge hidrix-tools into [pi](https://github.com/mariozechner/pi-coding-agent) as native custom tools.

Pi doesn't support MCP, so this extension imports hidrix-tools directly and registers each tool via `pi.registerTool()`.

## Install

```bash
# Copy to pi's global extensions directory
cp -r integrations/pi-extension ~/.pi/agent/extensions/hidrix-tools

# Or symlink
ln -s $(pwd)/integrations/pi-extension ~/.pi/agent/extensions/hidrix-tools
```

Then reload pi: type `/reload` in pi, or restart.

## What it does

- Registers all hidrix-tools as pi custom tools (prefixed `hidrix_`)
- Loads API keys from `~/hidrix-tools/.env` automatically
- Logs usage to `~/.hidrix-tools/usage.jsonl`
- Adds `/hidrix` command to check status and recent usage

## Tools registered

| Pi tool name | hidrix-tools equivalent |
|---|---|
| `hidrix_web_search` | web_search |
| `hidrix_web_fetch` | web_fetch |
| `hidrix_x_search` | x_search |
| `hidrix_x_thread_reader` | x_thread_reader |
| `hidrix_x_user_posts` | x_user_posts |
| `hidrix_reddit_search` | reddit_search |
| `hidrix_reddit_thread_reader` | reddit_thread_reader |
| `hidrix_reddit_subreddit_top` | reddit_subreddit_top |
| `hidrix_facebook_scraper` | facebook_scraper |
| `hidrix_content_scorer` | content_scorer |
| `hidrix_content_analyzer` | content_analyzer |

## Usage logging

Every tool call is logged to `~/.hidrix-tools/usage.jsonl`:

```jsonl
{"ts":"2026-04-03T09:30:00Z","tool":"x-search","input":{"query":"AI agents"},"status":"ok","ms":1200,"agent":"pi"}
{"ts":"2026-04-03T09:31:00Z","tool":"reddit-search","input":{"query":"LLM"},"status":"error","error":"timeout","ms":30000,"agent":"pi"}
```

Check status anytime: type `/hidrix` in pi.
