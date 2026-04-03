# Contributing

Thanks for your interest in contributing to hidrix-tools!

## Reporting Issues

- Use [GitHub Issues](https://github.com/sonpiaz/hidrix-tools/issues) to report bugs
- Include the tool name, error message, and steps to reproduce

## Adding a New Tool

Tools are auto-discovered — no edits to `server.ts` needed.

```bash
cp -r tools/_template tools/your-tool-name
# Edit tools/your-tool-name/index.ts
bun run server.ts
```

See [docs/adding-a-tool.md](docs/adding-a-tool.md) for the full guide with examples.

## Submitting PRs

1. Fork the repo and create a branch from `main`
2. Name your branch `feat/description` or `fix/description`
3. Make your changes and test locally
4. Write a clear PR description explaining what changed and why
5. Submit the PR against `main`

## Local Development

```bash
git clone https://github.com/sonpiaz/hidrix-tools.git
cd hidrix-tools
bun install
cp .env.example .env
# Add your API keys to .env
bun run server.ts
```

## Code Style

- TypeScript strict mode
- Use `async/await` with proper error handling
- Follow existing tool patterns for consistency
