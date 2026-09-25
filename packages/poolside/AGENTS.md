# pi-poolside

Pi extension package for the Poolside inference API. Lives in the
`pi-providers` monorepo under `packages/poolside`.

## Stack

- TypeScript (strict mode), pnpm workspace, Biome

## Scripts

- `pnpm typecheck` - Type check
- `pnpm lint` - Lint
- `pnpm format` - Format

Run checks from the repo root with `pnpm -r <script>`.

## Structure

```
extensions/
  provider/          # Provider extension (registers poolside provider)
    index.ts         # Entry point
    models.ts        # Model definitions and refresh parsing
```

## Extension API Patterns

- `pi.registerProvider(name, config)` - Register a custom LLM provider
- `refreshModels` on provider config - Refresh authenticated model catalog through Pi
