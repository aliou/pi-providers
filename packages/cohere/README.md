# pi-cohere

Pi provider extension for Cohere models.

## Installation

```bash
pi install npm:@aliou/pi-cohere
```

Set the API key before use:

```bash
export COHERE_API_KEY=...
```

## What it provides

- Registers a `cohere` provider in Pi.
- Uses Cohere HTTP endpoints directly, not the Cohere SDK.
- Fetches chat-capable models from `GET https://api.cohere.com/v1/models` when `COHERE_API_KEY` is available.
- Caches fetched models in Pi's model store and refreshes them through `/model` or `pi update --models`.
- Falls back to a small hardcoded model list when model fetching is unavailable.
- Uses Cohere's OpenAI-compatible endpoint at `https://api.cohere.ai/compatibility/v1` with Pi's native `openai-completions` provider path.
- Supports text, vision model metadata, tool calls, streamed usage, and context-overflow normalization.

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
```

## Layout

- `extensions/provider/`: Pi extension entry point.
- `src/cohere/`: Cohere model mapping and API helpers.

## Notes

Cohere returns usage in response bodies and a `num_tokens` header for non-streaming chat. I did not see quota, remaining-credit, or rate-limit headers while probing.
