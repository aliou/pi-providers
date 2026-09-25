# @aliou/pi-cohere

## 0.1.1

### Patch Changes

- 67fc8f7: Update Pi compatibility to 0.80.10 and cache Cohere model refreshes through Pi's model store.
- 371b4c6: Add Pi coding-agent 0.84 compatibility for the provider model refresh: the persisted model cache now goes through a runtime shape-detection shim (`src/refresh-store-compat.ts`) that uses the 0.84 `context.stored` snapshot and `context.publish({ persist })` transaction when available, and falls back to the legacy `context.store` read/write on older hosts. Cache TTL and offline fallback behavior are unchanged. The `@earendil-works/pi-coding-agent` peer range keeps its >=0.80.8 floor and now also supports 0.84.

## 0.1.0

### Minor Changes

- 69b7dba: Initial Cohere provider extension for Pi.

### Patch Changes

- 4a44d57: Align repository scaffolding and release workflow with pi-edgee.

## 0.0.1

### Patch Changes

- Initial scaffold.
