---
name: provider-models
description: Update hardcoded model metadata for the pi-providers packages (cohere, edgee, poolside). Use when refreshing model lists, checking model availability, or syncing hardcoded model metadata with a provider's API and models.dev.
---

# Update provider model metadata

Each package under `packages/` ships a hardcoded model cache used before live
models are fetched. Update it from live data, not guesses.

## Packages at a glance

| Package | Model file | Test | API key | Live source | models.dev |
|---|---|---|---|---|---|
| cohere | `packages/cohere/src/cohere/models.ts` | `packages/cohere/src/cohere/models.test.ts` | `COHERE_API_KEY` | `https://api.cohere.com/v1/models` | provider `cohere` |
| edgee | `packages/edgee/src/edgee/models.ts` | `packages/edgee/src/edgee/models.test.ts` | `EDGEE_API_KEY` | `https://edgee.io/v1/models` | upstream provider entries, keyed by the `{provider}/{model}` id split |
| poolside | `packages/poolside/extensions/provider/models.ts` | none | `POOLSIDE_API_KEY` | `https://inference.poolside.ai/v1/models` | not listed |

## Default behavior

1. Identify which package(s) to update.
2. Follow that package's section below for sources of truth and field mapping.
3. Update the model file.
4. Run that package's required checks.
5. Create a changeset for user-visible metadata changes.
6. Commit only relevant files when asked.

Do not push.

## Cohere

Sources of truth, in order:

1. `https://models.dev/api.json` provider `cohere` for pricing, context, output limits, modalities, and reasoning flags.
2. Cohere model list endpoint, when `COHERE_API_KEY` is available: `https://api.cohere.com/v1/models`. Requires an API key; without one, use models.dev and documented/runtime evidence.
3. `https://api.cohere.ai/compatibility/v1/chat/completions` runtime probe, only when availability is unclear. Never print the API key.
4. Docs: `https://docs.cohere.com/docs/compatibility-api` and `https://docs.cohere.com/docs/models`.
5. Existing hardcoded definitions for fields live sources do not expose.

Field mapping from models.dev:

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

Runtime probes (never echo `COHERE_API_KEY`):

```bash
curl -sS https://api.cohere.com/v1/models \
  -H "Authorization: bearer $COHERE_API_KEY" \
  -H 'accept: application/json'

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

Decision rules:

- Add a model when models.dev or runtime confirms it is available and it belongs to Cohere chat models.
- Keep hardcoded known models that are callable even if absent from `GET /v1/models`, such as `north-mini-code-1-0`.
- Do not remove a model only because `GET /v1/models` omits it if runtime or models.dev says it is callable.
- Leave cost at zero only when no pricing source exposes a price.
- Prefer `api.cohere.ai` for compatibility endpoint docs and provider base URL.

## Edgee

Sources of truth, in order:

1. `https://edgee.io/v1/models` (with `EDGEE_API_KEY`) for the live model list and each model's `owned_by` provider.
2. `https://models.dev/api.json` upstream provider entries (keyed by the provider prefix in the model id, e.g. `openai/gpt-5.2` -> provider `openai`, model `gpt-5.2`) for pricing, context, output limits, modalities, and reasoning flags. Edgee is a gateway, not a model host, and is NOT itself present on models.dev.
3. `https://edgee.io/v1/chat/completions` runtime probe, only when availability is unclear. Never print the API key.
4. Docs: `https://www.edgee.ai/docs/api-reference/models`.
5. Existing hardcoded definitions for fields live sources do not expose.

Field mapping from models.dev (upstream provider entry, model id = part after the `/`):

- `id` -> `id` (keep the `{provider}/{model}` format from Edgee's list)
- `modalities.input` containing `image` -> `input: ["text", "image"]`
- `reasoning` -> `reasoning`
- `limit.context` -> `contextWindow`
- `limit.output` -> `maxTokens`
- `cost.input` -> `cost.input`
- `cost.output` -> `cost.output`
- `cost.cache_read` -> `cost.cacheRead` (default 0)
- `cost.cache_write` -> `cost.cacheWrite` (default 0)

Provider compatibility defaults:

```ts
compat: {
  maxTokensField: "max_tokens",
  supportsUsageInStreaming: true,
}
```

Runtime probes (never echo `EDGEE_API_KEY`):

```bash
curl -sS https://edgee.io/v1/models \
  -H "Authorization: Bearer $EDGEE_API_KEY" \
  -H 'accept: application/json'

curl -sS https://edgee.io/v1/chat/completions \
  -H "Authorization: Bearer $EDGEE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d @- <<'JSON'
{
  "model": "openai/gpt-5.2",
  "messages": [{"role": "user", "content": "Reply exactly ok"}],
  "max_tokens": 5
}
JSON
```

Decision rules:

- Add a model when `/v1/models` or runtime confirms it is available.
- Keep hardcoded known models that are callable even if absent from `GET /v1/models`.
- Edgee compresses input tokens before the upstream provider sees them, so actual billed cost is lower than the models.dev list price. Cost metadata reflects upstream list price; do not adjust for compression.
- Leave cost at zero only when no pricing source exposes a price.
- Edgee is a gateway: never add Edgee itself to models.dev-based lookups.

## Poolside

Poolside is not on models.dev and its pricing returns $0 during the current
free preview; the hardcoded cache uses placeholder values until real pricing
ships.

Sources of truth, in order:

1. `https://inference.poolside.ai/v1/models` (with `POOLSIDE_API_KEY`) for live model IDs and availability.
2. Existing hardcoded definitions for fields the live endpoint does not expose (pricing, context window, max tokens).

There is no dedicated model test file for this package yet — run typecheck
and lint only.

Runtime probe (never echo `POOLSIDE_API_KEY`):

```bash
curl -sS https://inference.poolside.ai/v1/models \
  -H "Authorization: Bearer $POOLSIDE_API_KEY" \
  -H 'accept: application/json'
```

Decision rules:

- Add a model when the live endpoint confirms it is available.
- Keep placeholder pricing at the documented preview values until Poolside publishes real pricing.
- Do not fabricate a models.dev mapping for Poolside; it is not listed there.

## Required checks

Run from the package directory (`packages/<name>`):

```bash
pnpm test -- <model test file>   # cohere, edgee only; poolside has none
pnpm typecheck
pnpm lint
```

## Commit workflow

When asked to commit:

1. Run the checks above for each package you touched.
2. Check `git status`.
3. Stage only relevant files. Never use `git add .` or `git add -A`.
4. Use a concise conventional commit message.
