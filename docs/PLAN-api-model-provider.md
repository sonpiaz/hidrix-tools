# Plan: API Model Provider — MVP

## Product: Unified API Gateway cho open source LLM models

**Concept**: 1 API endpoint → user tạo key → gắn vào bất kỳ agent nào → chạy 20+ free models.
Ban đầu tất cả miễn phí. Paid tính sau.

## Kiến trúc

```
User (OpenClaw, Hermes, Cursor, any app)
│
│  POST /v1/chat/completions
│  Authorization: Bearer user-api-key
│  model: "llama-3.3-70b"
│
▼
┌─────────────────────────────────────────┐
│         Your API Gateway                 │
│                                          │
│  1. Auth: verify API key                 │
│  2. Route: model → provider mapping      │
│  3. Forward: call provider API           │
│  4. Track: log usage per key             │
│  5. Return: stream response back         │
│                                          │
│  OpenAI-compatible endpoint              │
│  (works with any SDK/agent out of box)   │
└──────────────┬───────────────────────────┘
               │
    ┌──────────┼──────────┬──────────┬──────────┐
    ▼          ▼          ▼          ▼          ▼
  Groq      Google     Cerebras   Mistral   Fireworks
  (free)    AI Studio   (free)    (free)     (free)
            (free)
```

## Backend providers (tất cả free, không cần credit card)

| Provider | Models hot nhất | Rate limit | Đặc điểm |
|---|---|---|---|
| **Groq** | Llama 3.3 70B, Llama 4 Scout, Qwen3 32B | 30 RPM, 1K req/day | Cực nhanh (300 tok/s) |
| **Google AI Studio** | Gemini 2.5 Pro, Flash | 5-15 RPM, 250K TPM | Context 1M tokens |
| **Cerebras** | Llama 3.3 70B, Qwen3 32B | 30 RPM, 1M tok/day | Nhanh |
| **Mistral AI** | Mistral Large, Codestral | 2 RPM, 1B tok/month | Models Pháp |
| **Cloudflare Workers AI** | Llama 3.2, Mistral 7B | N/A, 10K neurons/day | Edge deployment |
| **NVIDIA NIM** | DeepSeek R1, Llama, Kimi K2.5 | 40 RPM, 1K credits | NVIDIA models |
| **HuggingFace** | 300+ community models | Varies | Kho lớn nhất |
| **DeepSeek** | DeepSeek V3, R1 | No hard limit | 5M tokens free |

### Models sẽ có trên platform (MVP)

```
Open Source Models (free):
├── Llama 3.3 70B          ← via Groq (nhanh nhất)
├── Llama 4 Scout          ← via Groq
├── Qwen 3.6               ← via Groq / Cerebras
├── Gemma 4                ← via Google AI Studio
├── Gemini 2.5 Flash       ← via Google (free tier)
├── DeepSeek R1            ← via DeepSeek / NVIDIA
├── DeepSeek V3            ← via DeepSeek
├── Mistral Large          ← via Mistral
├── Codestral              ← via Mistral
├── GLM-5                  ← via z.AI
├── Kimi K2.5              ← via NVIDIA / Moonshot
└── Mixtral 8x22B          ← via Fireworks / Together
```

## Phases

### Phase 1: Core Engine (2-3 ngày)

Build API gateway — nhận request, route tới provider, trả response.

**Files cần tạo:**

```
api-provider/
├── src/
│   ├── server.ts              ← HTTP server (Bun.serve)
│   ├── router.ts              ← Model → provider routing
│   ├── providers/
│   │   ├── groq.ts            ← Forward tới Groq API
│   │   ├── google.ts          ← Forward tới Google AI Studio
│   │   ├── cerebras.ts        ← Forward tới Cerebras
│   │   ├── mistral.ts         ← Forward tới Mistral
│   │   ├── deepseek.ts        ← Forward tới DeepSeek
│   │   └── nvidia.ts          ← Forward tới NVIDIA NIM
│   ├── auth.ts                ← API key verify + create
│   ├── usage.ts               ← Track requests per key
│   └── models.ts              ← Model registry (name → provider)
├── db/
│   └── schema.sql             ← SQLite: users, api_keys, usage_logs
├── .env                       ← Provider API keys
└── package.json
```

**API endpoints:**

```
# Core (OpenAI-compatible)
POST /v1/chat/completions     ← Main endpoint, streams response
GET  /v1/models               ← List available models

# User management
POST /v1/auth/register        ← Create account (email)
POST /v1/auth/keys            ← Generate API key
GET  /v1/auth/usage           ← View usage stats
```

**Tại sao OpenAI-compatible?**

Vì mọi agent (OpenClaw, Hermes, Cursor, Claude Code proxy) đều hỗ trợ format này. User chỉ cần:
```
base_url: https://your-domain.com/v1
api_key: user-key-here
model: llama-3.3-70b
```
→ Chạy ngay, không cần sửa code.

### Phase 2: Deploy + First Users (1-2 ngày)

```
├── Deploy API lên VPS hoặc Cloudflare Workers
├── Domain: chọn tên .com hoặc .ai
├── Landing page: 1 trang, trắng, simple
│   ├── Tên + tagline
│   ├── "Get API Key" button
│   ├── Code example (3 dòng)
│   └── List models available
├── Docs page: OpenAI-compatible, model list, rate limits
└── Share: X, Reddit r/LocalLLaMA, Hacker News
```

### Phase 3: Dashboard UI (3-5 ngày)

```
├── Login/Register page
├── Dashboard:
│   ├── API keys management (create, revoke)
│   ├── Usage chart (requests/day, tokens used)
│   ├── Model explorer (browse available models)
│   └── Playground (test models in browser)
├── Design: white background, minimal, Mercury/Linear style
└── Tech: Next.js hoặc simple HTML + HTMX
```

### Phase 4: Growth + Monetize (tuần 3+)

```
├── Thêm models mới khi providers release
├── Smart routing: auto-pick cheapest/fastest provider per model
├── Fallback: nếu Groq down → tự chuyển sang Cerebras
├── Paid tier: forward tới OpenAI/Anthropic (margin = revenue)
├── Analytics: model popularity, peak hours, error rates
└── Dùng knowledge base → track competitor moves, feature requests
```

## Knowledge Base liên kết thế nào?

### Trước khi build
- `competitors/openrouter.md` → biết feature gì họ có
- `signals/pricing-signal.md` → biết user quan tâm giá thế nào
- `signals/pain-point.md` → biết user ghét gì ở competitors

### Trong khi build
- Follow @OpenRouterAI, @GroqInc → biết models mới
- `signals/trend-signal.md` → biết model nào hot (Qwen 3.6, Gemma 4)
- Compile hàng ngày → wiki tự update model landscape

### Sau khi launch
- Track user feedback (Reddit, X mentions)
- `signals/feature-request.md` → biết feature nào cần thêm
- `ideas/auto-generated.md` → gợi ý hướng phát triển
- `markets/llm-api-gateway.md` → market overview

## Chi phí

| Hạng mục | Chi phí |
|---|---|
| Provider APIs | $0 (free tiers) |
| VPS deploy | $5-20/tháng (Hetzner/Railway) |
| Domain | $10-15/năm |
| Tổng khởi đầu | **~$20** |

## So sánh với competitors

| Feature | OpenRouter | Bạn (MVP) |
|---|---|---|
| Models | 200+ | 12-15 (free only) |
| Pricing | Pay per token | **Free** |
| Credit card | Cần cho paid | **Không cần** |
| Speed | Varies | Groq = cực nhanh |
| Target | Developers | **Agent builders** (OpenClaw, Hermes, Cursor) |
| Differentiator | Model variety | **Zero cost, zero friction** |

**USP ban đầu**: "Free LLM API for AI agents. No credit card. No setup. Just get a key and go."

## Ưu tiên build

| # | Gì | Effort | Deliverable |
|---|---|---|---|
| 1 | Core engine: server + router + auth | 1 ngày | API chạy được |
| 2 | Providers: Groq + Google + Cerebras | 1 ngày | 10+ models |
| 3 | Deploy + landing page | 1 ngày | Online, user đầu tiên |
| 4 | Dashboard UI | 3-5 ngày | User self-serve |
