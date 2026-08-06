---
"@aliou/pi-edgee": patch
---

Add Pi coding-agent 0.84 compatibility for the provider model refresh: the persisted model cache now goes through a runtime shape-detection shim (`src/refresh-store-compat.ts`) that uses the 0.84 `context.stored` snapshot and `context.publish({ persist })` transaction when available, and falls back to the legacy `context.store` read/write on older hosts. The cached-model fallback, Edgee lookup, and offline behavior are unchanged. The `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` peer ranges keep their >=0.80.8 floor and now also support 0.84.
