# Contributing

Thanks for your interest in contributing to hidrix-tools!

## Reporting Issues

- Use [GitHub Issues](https://github.com/sonpiaz/hidrix-tools/issues) to report bugs
- Include the tool name, error message, and steps to reproduce

## Adding a New Tool

1. Create `tools/your-tool.ts` following the pattern in existing tools
2. Import and register in `server.ts`
3. Add to the tools table in `README.md`
4. Test with `bun run server.ts`

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
