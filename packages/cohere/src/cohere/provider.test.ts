import type {
  ModelsStoreEntry,
  RefreshModelsContext,
} from "@earendil-works/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { COHERE_API_KEY_ENV, FALLBACK_COHERE_MODELS } from "./models";
import { COHERE_BASE_URL, createCohereProvider } from "./provider";
import type { FetchCohereApiModels } from "./refresh-models";

const fetchedConfig = {
  id: "command-fetched",
  name: "Command Fetched",
  reasoning: false,
  input: ["text" as const],
  cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 4000,
};

function createProvider(
  options: { fetchApiModels?: FetchCohereApiModels } = {},
) {
  const fetchApiModels = vi.fn<FetchCohereApiModels>(
    options.fetchApiModels ?? (async () => [fetchedConfig]),
  );
  const provider = createCohereProvider(fetchApiModels);
  return { provider, fetchApiModels };
}

function createContext(
  options: {
    allowNetwork?: boolean;
    credential?: { type: "api_key"; key: string };
    stored?: ModelsStoreEntry;
    signal?: AbortSignal;
  } = {},
): RefreshModelsContext {
  const publish = vi.fn(
    async (publication: {
      persist?: ModelsStoreEntry | null;
      update?: () => void;
    }): Promise<boolean> => {
      publication.update?.();
      return true;
    },
  );

  return {
    credential: options.credential,
    allowNetwork: options.allowNetwork ?? true,
    force: false,
    signal: options.signal ?? new AbortController().signal,
    stored: options.stored,
    publish,
  } as unknown as RefreshModelsContext;
}

function storedEntry(ids: string[]): ModelsStoreEntry {
  return {
    models: ids.map((id) => ({
      id,
      name: id,
      api: "openai-completions",
      provider: "cohere",
      baseUrl: COHERE_BASE_URL,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 4000,
    })),
    checkedAt: Date.now(),
  } as unknown as ModelsStoreEntry;
}

function authCtx(env: Record<string, string | undefined> = {}) {
  return {
    env: async (name: string) => env[name],
    fileExists: async () => false,
  };
}

describe("createCohereProvider", () => {
  it("registers full pi-ai models stamped with api/provider/baseUrl", () => {
    const { provider } = createProvider();
    expect(provider.id).toBe("cohere");
    expect(provider.baseUrl).toBe(COHERE_BASE_URL);
    for (const model of provider.getModels()) {
      expect(model.api).toBe("openai-completions");
      expect(model.provider).toBe("cohere");
      expect(model.baseUrl).toBe(COHERE_BASE_URL);
    }
  });
});

describe("auth.apiKey.resolve", () => {
  it("prefers the stored credential", async () => {
    const { provider } = createProvider();
    const result = await provider.auth.apiKey?.resolve({
      ctx: authCtx({ [COHERE_API_KEY_ENV]: "env-key" }),
      credential: { type: "api_key", key: "stored-key" },
      signal: new AbortController().signal,
    });
    expect(result?.auth.apiKey).toBe("stored-key");
    expect(result?.source).toBe("stored credential");
  });

  it("falls back to the COHERE_API_KEY environment variable", async () => {
    const { provider } = createProvider();
    const result = await provider.auth.apiKey?.resolve({
      ctx: authCtx({ [COHERE_API_KEY_ENV]: "env-key" }),
      signal: new AbortController().signal,
    });
    expect(result?.auth.apiKey).toBe("env-key");
    expect(result?.source).toBe(COHERE_API_KEY_ENV);
  });

  it("never fails: resolves anonymously so model refresh works without credentials", async () => {
    const { provider } = createProvider();
    const result = await provider.auth.apiKey?.resolve({
      ctx: authCtx(),
      signal: new AbortController().signal,
    });
    expect(result).toEqual({ auth: { apiKey: "" }, source: "anonymous" });
  });
});

describe("auth.apiKey.check", () => {
  it("reports unconfigured without a key so models stay hidden from /model", async () => {
    const { provider } = createProvider();
    const result = await provider.auth.apiKey?.check?.({
      ctx: authCtx(),
      signal: new AbortController().signal,
    });
    expect(result).toBeUndefined();
  });

  it("reports configured with an env key or stored credential", async () => {
    const { provider } = createProvider();
    await expect(
      provider.auth.apiKey?.check?.({
        ctx: authCtx({ [COHERE_API_KEY_ENV]: "env-key" }),
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({ type: "api_key", source: COHERE_API_KEY_ENV });
    await expect(
      provider.auth.apiKey?.check?.({
        ctx: authCtx(),
        credential: { type: "api_key", key: "stored-key" },
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({ type: "api_key", source: "stored credential" });
  });
});

describe("refreshModels", () => {
  it("publishes fetched models merged over the fallback catalog", async () => {
    const { provider, fetchApiModels } = createProvider();

    await provider.refreshModels?.(
      createContext({ credential: { type: "api_key", key: "key" } }),
    );

    expect(fetchApiModels).toHaveBeenCalledWith("key", expect.anything());
    const ids = provider.getModels().map((model) => model.id);
    expect(ids).toContain("command-fetched");
    for (const fallback of FALLBACK_COHERE_MODELS) {
      expect(ids).toContain(fallback.id);
    }
  });

  it("resolves anonymously to a soft failure: keeps the fallback catalog without throwing", async () => {
    const { provider, fetchApiModels } = createProvider();

    await provider.refreshModels?.(
      createContext({ credential: { type: "api_key", key: "" } }),
    );

    expect(fetchApiModels).not.toHaveBeenCalled();
    expect(provider.getModels().map((model) => model.id)).toEqual(
      FALLBACK_COHERE_MODELS.map((model) => model.id),
    );
  });

  it("restores a fresh stored catalog without fetching", async () => {
    const { provider, fetchApiModels } = createProvider();

    await provider.refreshModels?.(
      createContext({
        credential: { type: "api_key", key: "key" },
        stored: storedEntry(["command-stored"]),
      }),
    );

    expect(fetchApiModels).not.toHaveBeenCalled();
    const ids = provider.getModels().map((model) => model.id);
    expect(ids).toContain("command-stored");
    expect(provider.getModels()[0]?.provider).toBe("cohere");
  });

  it("restores the stored catalog in offline phases without fetching", async () => {
    const { provider, fetchApiModels } = createProvider();

    await provider.refreshModels?.(
      createContext({
        allowNetwork: false,
        stored: storedEntry(["command-stored"]),
      }),
    );

    expect(fetchApiModels).not.toHaveBeenCalled();
    expect(provider.getModels().map((model) => model.id)).toContain(
      "command-stored",
    );
  });

  it("keeps the current catalog when the fetch fails", async () => {
    const { provider } = createProvider({
      fetchApiModels: async () => {
        throw new Error("network down");
      },
    });

    await provider.refreshModels?.(
      createContext({ credential: { type: "api_key", key: "key" } }),
    );

    expect(provider.getModels().map((model) => model.id)).toEqual(
      FALLBACK_COHERE_MODELS.map((model) => model.id),
    );
  });
});
