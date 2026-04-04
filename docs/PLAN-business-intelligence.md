# Plan: Business Intelligence Layer for Knowledge Base

## Mục tiêu

Mở rộng wiki từ "kiến thức chung" → "business intelligence" để hỗ trợ ra quyết định kinh doanh cho SaaS products (Whisper wrapper, UGC AI, API aggregator, etc).

## Hiện tại

```
Knowledge Base chỉ có:
├── people/       ← thought leaders (karpathy, levelsio, steipete, bcherny)
├── concepts/     ← technical concepts (vibe-coding, llm-knowledge-base)
├── raw/          ← raw collected data
└── _index.md
```

Agent collect posts → compile thành people + concept articles. Chưa có business context.

## Cần thêm

```
├── markets/      ← market analysis per vertical
├── competitors/  ← competitor profiles (features, pricing, weaknesses)
├── apis/         ← API landscape (pricing, limits, comparison)
├── revenue/      ← monetization models & benchmarks
├── signals/      ← auto-detected market signals
└── ideas/        ← business ideas generated from signals
```

---

## Phase B1 — Business follow list + keywords (15 phút)

### Thêm keywords vào follow list

```
Keywords (market signals):
- "whisper API" → x, reddit (daily)
- "speech to text API" → x, reddit (weekly)
- "UGC AI" → x, reddit, linkedin (daily)
- "AI API pricing" → x, reddit (weekly)
- "alternative to [competitor]" → reddit (weekly)
- "MRR saas" → x, linkedin (weekly)

Keywords (competitor monitoring):
- "deepgram" → x, reddit (daily)
- "assembly AI" → x, reddit (daily)
- "eleven labs" → x (daily)
- "heygen" → x (daily)
```

### Thêm competitor accounts vào X follows

Research trước: tìm X handles của competitors + SaaS builders relevant.

### Deliverable
- `~/.hidrix-tools/follows.json` updated
- Test: `bun run scripts/follow.ts list` shows business keywords

---

## Phase B2 — Signal extractor trong compile.ts (1-2h)

### Mục tiêu

Khi compile, tự detect "market signals" từ posts đã collect:

| Signal type | Pattern detect | Ví dụ |
|---|---|---|
| **Pain point** | "expensive", "too costly", "overpriced", "costs too much" | "Deepgram is getting expensive for startups" |
| **Alternative seeking** | "alternative to", "replacement for", "switching from", "moved away from" | "Looking for alternative to Assembly AI" |
| **Feature request** | "wish it had", "would be great if", "missing feature", "need a way to" | "Whisper API needs diarization" |
| **Pricing complaint** | "pricing", "free tier", "rate limit", "too limited" | "ElevenLabs free tier is useless" |
| **Positive signal** | "love", "amazing", "switched to", "game changer", "best tool" | "Switched to Deepgram, 10x faster" |
| **Trend signal** | "just launched", "new API", "now supports", "announcing" | "OpenAI just launched real-time API" |

### Output

```
signals/
├── pain-points.md          ← auto-updated each compile
├── alternative-seeking.md  ← "people looking for alternatives to X"
├── feature-requests.md     ← "features people want"
├── pricing-signals.md      ← "pricing complaints/praise"
└── trend-signals.md        ← "new launches, announcements"
```

Mỗi file format:
```markdown
# Pain Points

> Auto-detected from collected posts. Last updated: 2026-04-04

## Speech-to-Text

- "Deepgram is getting expensive for startups" — @user, X, 2026-04-03
  Score: 450 | Source: [[deepgram]]
  
- "Whisper API latency is terrible for real-time" — r/MachineLearning
  Score: 230 | Related: [[whisper]], [[real-time-api]]

## UGC AI

- "HeyGen pricing is insane for small creators" — @user, X
  Score: 120 | Source: [[heygen]]
```

### Cách build

Thêm function `extractSignals()` vào `compile.ts`:
- Scan tất cả posts trong data_store
- Pattern match với signal keywords
- Group theo market/competitor
- Write to `signals/*.md` files
- Append new signals to daily log

### Deliverable
- `compile.ts` updated with signal extraction
- 5 signal files auto-generated
- `_daily-log.md` includes signal summary

---

## Phase B3 — Competitor profiles (1h)

### Mục tiêu

Auto-generate competitor profile pages từ collected data.

### Cách detect competitors

Maintain list trong compile config:

```typescript
const COMPETITORS = {
  "speech-to-text": ["deepgram", "assembly ai", "assemblyai", "rev ai", "speechmatics", "whisper"],
  "voice-ai": ["eleven labs", "elevenlabs", "play.ht", "murf ai", "resemble ai"],
  "ugc-ai": ["heygen", "synthesia", "d-id", "colossyan", "elai"],
  "llm-providers": ["openai", "anthropic", "google gemini", "mistral", "groq", "together ai"],
  "search-apis": ["brave search", "serpapi", "serper", "getxapi", "tavily"],
};
```

### Output per competitor

```markdown
# Deepgram

> Speech-to-text API provider

## Market: [[ai-transcription]]

## Mentions (auto-collected)
- 15 mentions across X + Reddit this week
- Sentiment: 60% positive, 25% neutral, 15% negative

## Pricing Signals
- "Deepgram pay-as-you-go starts at $0.0043/min" — web
- "Free tier: 12,000 minutes" — @user

## Pain Points (from [[pain-points]])
- Latency for streaming
- Limited language support

## Positive Signals
- "Best accuracy for English" — 3 mentions
- "API is super clean" — 2 mentions

## vs Others
- vs [[assembly-ai]]: cheaper, less features
- vs [[whisper]]: faster API, less accurate offline

---
Last updated: 2026-04-04
Sources: 15 posts from X, 8 from Reddit
```

### Cách build

Thêm function `compileCompetitors()` vào `compile.ts`:
- Match competitor names trong posts
- Group mentions per competitor
- Simple sentiment: positive/negative keyword match
- Extract pricing mentions (regex: `$`, `per`, `month`, `free tier`)
- Write to `competitors/*.md`

### Deliverable
- Competitor profiles auto-generated
- Linked to signals + markets

---

## Phase B4 — Market + API analysis pages (1h)

### Markets

Auto-generate từ competitor groupings:

```markdown
# AI Transcription Market

## Players
| Company | Pricing | Strength | Weakness |
|---|---|---|---|
| [[deepgram]] | $0.0043/min | Speed, API | Language support |
| [[assembly-ai]] | $0.00025/sec | Features | Pricing |
| [[whisper]] (OpenAI) | Free (self-host) | Accuracy | Latency |

## Market Signals
- 45 mentions this week (up 20% from last week)
- Top pain point: pricing for startups
- Top request: real-time streaming

## Opportunity
_Agent will analyze signals and suggest opportunities._

## Related
- [[pain-points]] | [[pricing-signals]] | [[trend-signals]]
```

### APIs

Auto-collect pricing from docs pages:

```markdown
# Speech-to-Text APIs

## Comparison

| API | Price | Free Tier | Latency | Languages |
|---|---|---|---|---|
| Deepgram | $0.0043/min | 12K min | 100ms | 30+ |
| AssemblyAI | $0.00025/sec | 100hrs | 200ms | 20+ |
| Whisper API | $0.006/min | None | 500ms | 50+ |
| Google STT | $0.006/min | 60min/mo | 150ms | 120+ |

## Sources
- Deepgram: web_fetch https://deepgram.com/pricing
- AssemblyAI: web_fetch https://assemblyai.com/pricing

_Last verified: 2026-04-04_
```

### Cách build

- `markets/*.md` — generated from competitor groupings + signal aggregation
- `apis/*.md` — manual seed + auto-update from `web_fetch` pricing pages

### Deliverable
- Market overview pages
- API comparison pages
- All linked to competitors + signals

---

## Phase B5 — Idea generator (1h)

### Mục tiêu

Khi có đủ signals, auto-suggest business ideas.

### Logic

```
IF pain_points["expensive"] > 3 mentions for competitor X
AND alternative_seeking[X] > 2 mentions
THEN → idea: "Cheaper alternative to X, focus on [top_feature_request]"

IF trend_signals["new API"] for category Y
AND no competitor covers it well
THEN → idea: "Build wrapper/integration for new Y API"

IF feature_requests[feature] > 5 mentions
AND no competitor has it
THEN → idea: "Add [feature] as differentiator"
```

### Output

```markdown
# 💡 Business Ideas

> Auto-generated from market signals. Review and validate.

## High Confidence

### 1. Cheaper Deepgram alternative for startups
- Signal: 8 "expensive" mentions + 3 "alternative to deepgram"
- Gap: no player targets <$10/mo startups with good accuracy
- Revenue model: usage-based, $0.002/min
- Related: [[deepgram]], [[pricing-signals]], [[ai-transcription]]

### 2. Whisper API with built-in diarization
- Signal: 5 "wish whisper had diarization" on Reddit
- Gap: Whisper = best accuracy, but no speaker identification
- Revenue model: API wrapper, charge per feature
- Related: [[whisper]], [[feature-requests]]

## Exploratory

### 3. UGC AI for Vietnamese market
- Signal: "heygen" + "vietnam" trending, no local player
- Gap: all UGC tools English-first
- Related: [[heygen]], [[ugc-ai]], [[trend-signals]]
```

### Cách build

Thêm function `generateIdeas()` vào `compile.ts`:
- Analyze signal files
- Pattern match opportunity templates
- Score by signal strength (mentions × engagement)
- Write to `ideas/auto-generated.md`
- Append to daily log

### Deliverable
- `ideas/auto-generated.md` — refreshed each compile
- Ideas ranked by signal confidence

---

## Phase B6 — Pi skill update (30 phút)

### Update `knowledge-compiler` skill

Thêm business commands:

```
"phân tích đối thủ deepgram" → đọc competitors/deepgram.md + collect thêm
"market analysis cho speech-to-text" → đọc markets/ai-transcription.md
"có signal gì mới?" → đọc signals/ files
"idea nào hot nhất?" → đọc ideas/auto-generated.md
"so sánh pricing deepgram vs assemblyai" → đọc apis/speech-to-text.md
"research [competitor] và lưu vào wiki" → search + compile competitor profile
```

### Deliverable
- Updated skill file
- Pi understands business queries

---

## Summary

| Phase | Gì | Effort | Output |
|---|---|---|---|
| **B1** | Business keywords + follows | 15 phút | Follow list mở rộng |
| **B2** | Signal extractor | 1-2h | `signals/` auto-detected |
| **B3** | Competitor profiles | 1h | `competitors/` auto-generated |
| **B4** | Market + API pages | 1h | `markets/` + `apis/` |
| **B5** | Idea generator | 1h | `ideas/` auto-scored |
| **B6** | Pi skill update | 30 phút | Agent hiểu business queries |

**Total: ~5-6h**

**Priority**: B1 → B2 → B3 (core value) → B4 → B5 → B6

Sau khi build xong, mỗi lần `compile.ts` chạy → wiki có:
- Ai đang phàn nàn gì (signals)
- Đối thủ đang làm gì (competitors)  
- Market opportunity ở đâu (markets)
- Nên build gì (ideas)

Tất cả auto-updated, đọc trong Obsidian, hỏi Pi bất cứ lúc nào.
