# Feedback & Bug Reporting

Standards for detecting, reporting, and fixing issues in hidrix-tools — for both agents and humans.

## When to report

A tool needs a bug report when any of these happen:

| Signal | Example | Severity |
|--------|---------|----------|
| **Empty results** | `facebook_scraper` returns 0 posts for a known-active group | 🔴 High |
| **Wrong data** | Reactions count is 0 but post clearly has engagement | 🟠 Medium |
| **Timeout** | Actor runs > 5 minutes with no result | 🟠 Medium |
| **Crash** | `Error: Cannot read property 'map' of undefined` | 🔴 High |
| **Auth error** | `401 Unauthorized` or `403 Forbidden` from provider | 🟡 Low (config issue) |
| **Stale data** | Posts returned are months old when `since` was set | 🟠 Medium |
| **Format broken** | Markdown output is garbled or missing fields | 🟡 Low |
| **Provider changed** | Apify actor deprecated or API response schema changed | 🔴 High |

## How to report

### For agents (automated)

When a tool returns an error or unexpected result, create a structured report:

```markdown
## Bug Report: [tool_name]

**Tool**: facebook_scraper
**Mode**: group
**Input**: `{ source_type: "group", targets: "https://facebook.com/groups/xxx", max_posts: 50 }`
**Expected**: 50 posts with engagement data
**Actual**: 0 posts returned, no error message
**Provider**: Apify crowdpull/facebook-group-posts-scraper
**Timestamp**: 2026-04-03T09:30:00Z

### Debug info
- Apify run ID: yTSKs7TRFBGSfeims
- Apify run status: SUCCEEDED
- Dataset items: 0
- Possible cause: Actor free tier limitation or group is private

### Suggested fix
Try alternative actor `scraper-engine/facebook-group-posts-and-details-scraper`
or switch to `thescrapelab/apify-facebook-post-scraper` with cookie auth.
```

### For humans

Open an issue on the repo or add to `docs/known-issues.md` with:
1. What you did (input)
2. What happened (actual output)
3. What you expected
4. Any error messages or logs

## Where to report

| Method | When |
|--------|------|
| **GitHub Issue** | Bug in tool code, new feature request |
| **`docs/known-issues.md`** | Known limitations, provider quirks |
| **Inline `// TODO:`** | Quick fix needed in code |
| **PR with fix** | You already know the solution |

## Feedback loop mechanism

### 1. Tool-level health check

Every tool should validate its output before returning:

```typescript
// In tool execute():
if (posts.length === 0) {
  return [
    `⚠️ No results found.`,
    ``,
    `**Possible causes:**`,
    `- Group/page is private (not public)`,
    `- Provider API changed or rate-limited`,
    `- API token expired or invalid`,
    ``,
    `**Debug:** source_type=${sourceType}, targets=${targets}`,
    `**Provider:** ${actorId}`,
    ``,
    `Report this if the target is definitely public and active.`,
  ].join("\n");
}
```

### 2. Provider health status

The `lib/apify.ts` client tracks run status. If a run fails:
- Log the Apify run ID for debugging
- Include status message in error output
- Suggest checking Apify console: `https://console.apify.com/organization/runs/{runId}`

### 3. Regression detection

When updating a tool or provider:

```bash
# Run the smoke test
bun test:smoke

# Manual check: does this still return data?
bun -e 'import { definition } from "./tools/facebook-scraper/index.ts"; 
const r = await definition.execute({ source_type: "page", targets: "100064860875397", max_posts: 3, sort: "relevant", countries: "US", ad_status: "active" }); 
console.log(r.includes("posts") ? "✅ PASS" : "❌ FAIL: empty result");'
```

### 4. Provider fallback chain (future)

When a provider fails, try the next one automatically:

```
Apify crowdpull → Apify scraper-engine → Apify thescrapelab → error with instructions
```

This is tracked in the provider-registry design but not yet implemented.

## Known provider quirks

| Provider | Quirk | Workaround |
|----------|-------|------------|
| Apify `crowdpull/facebook-group-posts-scraper` | Returns 0 posts on free tier for some groups | Try paid tier or different actor |
| Apify `data-slayer/facebook-page-posts` | Takes pageId (numeric), not URL | Extract ID from URL before calling |
| Meta Ad Library API | Rate limit 200 calls/hour | Batch queries, cache results |
| Meta Ad Library API | Only political ads have spend/impressions data | Commercial ads have creative only |

## Severity levels

- 🔴 **High**: Tool completely broken, no workaround
- 🟠 **Medium**: Tool works but returns wrong/incomplete data
- 🟡 **Low**: Cosmetic, config issue, or has easy workaround

## Checklist for fixing a bug

- [ ] Reproduce the bug with the exact input from the report
- [ ] Identify root cause (code bug vs provider change vs config)
- [ ] Fix and test locally
- [ ] Update `docs/known-issues.md` if it's a provider limitation
- [ ] Add inline comment explaining the fix
- [ ] Commit with message: `fix(tool_name): description of fix`
