---
name: cohere-models
description: Update model metadata for the pi-cohere extension. Use when refreshing Cohere model lists, checking Cohere model availability, or syncing hardcoded model metadata with Cohere API and models.dev.
---

# Update Cohere models

Update `src/cohere/models.ts` from live Cohere and models.dev data, not guesses.

## Default behavior

Take initiative:

1. Check public pricing and limits in `https://models.dev/api.json` under provider `cohere`.
2. If `COHERE_API_KEY` is available, fetch `https://api.cohere.com/v1/models` to confirm API-visible chat models.
3. Remember: Cohere's model list endpoint requires an API key. Without one, use models.dev and documented/runtime evidence.
4. Probe `https://api.cohere.ai/compatibility/v1/chat/completions` only when availability is unclear. Never print the API key.
5. Update `src/cohere/models.ts`.
6. Run model tests plus typecheck and lint.
7. Create a changeset for user-visible metadata changes.
8. Commit only relevant files when asked.

Do not push.

## Sources of truth

Use these in order:

1. `https://models.dev/api.json` provider `cohere` for pricing, context, output limits, modalities, and reasoning flags.
2. Cohere model list endpoint, when `COHERE_API_KEY` is available: `https://api.cohere.com/v1/models`.
3. Cohere compatibility endpoint runtime checks: `https://api.cohere.ai/compatibility/v1/chat/completions`.
4. Cohere docs: `https://docs.cohere.com/docs/compatibility-api` and `https://docs.cohere.com/docs/models`.
5. Existing hardcoded definitions for fields live sources do not expose.

## Required checks

Run:

```bash
pnpm test -- src/cohere/models.test.ts
pnpm typecheck
pnpm lint
```

## Field mapping

From models.dev:

- `id` -> `id`
- `name` -> `name` where appropriate, otherwise keep existing display formatting
- `modalities.input` containing `image` -> `input: ["text", "image"]`
- `reasoning` -> `reasoning`
- `limit.context` -> `contextWindow` when models.dev is the source for that model
- `limit.output` -> `maxTokens`
- `cost.input` -> `cost.input`
- `cost.output` -> `cost.output`

Provider compatibility defaults:

```ts
compat: {
  maxTokensField: "max_tokens",
  supportsUsageInStreaming: true,
}
```

## Runtime probes

Use these only when needed. Never echo `COHERE_API_KEY`.

### Check model list

```bash
curl -sS https://api.cohere.com/v1/models \
  -H "Authorization: bearer $COHERE_API_KEY" \
  -H 'accept: application/json'
```

### Check compatibility chat

```bash
curl -sS https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer $COHERE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d @- <<'JSON'
{
  "model": "command-a-03-2025",
  "messages": [{"role": "user", "content": "Reply exactly ok"}],
  "max_tokens": 5
}
JSON
```

## Decision rules

- Add a model when models.dev or runtime confirms it is available and it belongs to Cohere chat models.
- Keep hardcoded known models that are callable even if absent from `GET /v1/models`, such as `north-mini-code-1-0`.
- Do not remove a model only because `GET /v1/models` omits it if runtime or models.dev says it is callable.
- Leave cost at zero only when no pricing source exposes a price.
- Prefer `api.cohere.ai` for compatibility endpoint docs and provider base URL.

## Commit workflow

When asked to commit:

1. Run checks.
2. Check `git status`.
3. Stage only relevant files. Never use `git add .` or `git add -A`.
4. Use a concise conventional commit message.
