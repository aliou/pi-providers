# @aliou/pi-edgee

## 0.1.4

### Patch Changes

- 02e4c69: Point package metadata at the `aliou/pi-providers` monorepo. The code is unchanged; this patch refreshes the npm page's repository link.

## 0.1.3

### Patch Changes

- 3522e66: Add Pi coding-agent 0.84 compatibility for the provider model refresh: the persisted model cache now goes through a runtime shape-detection shim (`src/refresh-store-compat.ts`) that uses the 0.84 `context.stored` snapshot and `context.publish({ persist })` transaction when available, and falls back to the legacy `context.store` read/write on older hosts. The cached-model fallback, Edgee lookup, and offline behavior are unchanged. The `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` peer ranges keep their >=0.80.8 floor and now also support 0.84.

## 0.1.2

### Patch Changes

- d1d9952: Update the Edgee provider for Pi 0.80.10 and use Pi's model store for dynamic model caching.

## 0.1.1

### Patch Changes

- 53e5c7f: Update Edgee model metadata enrichment.

  - Removed the models.dev-sourced fallback metadata table.
  - `session_start` enrichment now uses Pi's built-in registry directly.
  - For Edgee-only providers (`meta`, `qwen`), the lookup falls back to OpenRouter models in Pi's registry for matching upstream model metadata.

## 0.1.0

### Minor Changes

- 983a7b2: Initial Edgee provider extension for Pi.

## 0.0.1

### Patch Changes

- Initial scaffold.
