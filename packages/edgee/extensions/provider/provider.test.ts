import type {
  AuthContext,
  ModelsStoreEntry,
  ProviderAuthInteraction,
  RefreshModelsContext,
} from "@earendil-works/pi-ai";
import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import {
  EDGEE_API_KEY_ENV,
  EDGEE_ATTRIBUTION_HEADERS,
  EDGEE_PROVIDER_BASE_URL,
  EDGEE_PROVIDER_ID,
  EDGEE_SESSION_ID_HEADER,
} from "../../src";
import type { EdgeeProviderDeps } from "./provider";
import { createEdgeeProvider } from "./provider";

const fetchedConfig: ProviderModelConfig = {
  id: "openai/gpt-5.2",
  name: "OpenAI gpt-5.2",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 8192,
};

const storedConfig: ProviderModelConfig = {
  ...fetchedConfig,
  id: "anthropic/claude-opus-4.6",
  name: "Anthropic claude-opus-4.6",
};

function storedEntry(
  models: ProviderModelConfig[],
  ageMs = 0,
): ModelsStoreEntry {
  return {
    models,
    checkedAt: Date.now() - ageMs,
  } as unknown as ModelsStoreEntry;
}

function createProvider(deps: Partial<EdgeeProviderDeps> = {}) {
  const fetchModels = vi.fn(async () => [fetchedConfig]);
  const provider = createEdgeeProvider({
    createClient: () => ({}) as never,
    fetchModels,
    createLookup: () => undefined,
    ...deps,
  });
  return { provider, fetchModels };
}

function createContext(
  options: {
    allowNetwork?: boolean;
    force?: boolean;
    credential?: { type: "api_key"; key?: string };
    stored?: ModelsStoreEntry;
    signal?: AbortSignal;
  } = {},
): RefreshModelsContext & { publish: ReturnType<typeof vi.fn> } {
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
    force: options.force,
    signal: options.signal ?? new AbortController().signal,
    stored: options.stored,
    publish,
  } as unknown as RefreshModelsContext & {
    publish: ReturnType<typeof vi.fn>;
  };
}

function authCtx(env: Record<string, string | undefined> = {}): AuthContext {
  return {
    env: async (name: string) => env[name],
    fileExists: async () => false,
  };
}

describe("createEdgeeProvider", () => {
  it("exposes the Edgee id, base URL, and attribution headers", () => {
    const { provider } = createProvider();
    expect(provider.id).toBe(EDGEE_PROVIDER_ID);
    expect(provider.baseUrl).toBe(EDGEE_PROVIDER_BASE_URL);
    expect(provider.headers).toEqual(EDGEE_ATTRIBUTION_HEADERS);
    expect(provider.getModels()).toEqual([]);
  });
});

describe("auth.apiKey.resolve", () => {
  it("prefers the stored credential", async () => {
    const { provider } = createProvider();
    const result = await provider.auth.apiKey?.resolve({
      ctx: authCtx({ [EDGEE_API_KEY_ENV]: "env-key" }),
      credential: { type: "api_key", key: "stored-key" },
      signal: new AbortController().signal,
    });
    expect(result?.auth.apiKey).toBe("stored-key");
    expect(result?.source).toBe("stored credential");
  });

  it("falls back to the EDGEE_API_KEY environment variable", async () => {
    const { provider } = createProvider();
    const result = await provider.auth.apiKey?.resolve({
      ctx: authCtx({ [EDGEE_API_KEY_ENV]: "env-key" }),
      signal: new AbortController().signal,
    });
    expect(result?.auth.apiKey).toBe("env-key");
    expect(result?.source).toBe(EDGEE_API_KEY_ENV);
  });

  it("never fails: resolves anonymously so catalog refresh works without credentials", async () => {
    const { provider } = createProvider();
    const result = await provider.auth.apiKey?.resolve({
      ctx: authCtx(),
      signal: new AbortController().signal,
    });
    expect(result).toEqual({ auth: { apiKey: "" }, source: "anonymous" });
  });

  it("honors the abort signal", async () => {
    const { provider } = createProvider();
    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.auth.apiKey?.resolve({
        ctx: authCtx(),
        signal: controller.signal,
      }),
    ).rejects.toThrow();
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
        ctx: authCtx({ [EDGEE_API_KEY_ENV]: "env-key" }),
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({ source: EDGEE_API_KEY_ENV });
    await expect(
      provider.auth.apiKey?.check?.({
        ctx: authCtx(),
        credential: { type: "api_key", key: "stored-key" },
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({ source: "stored credential" });
  });
});

describe("auth.apiKey.login", () => {
  it("prompts for the key", async () => {
    const { provider } = createProvider();
    const prompt = vi.fn(async () => "entered-key");
    const credential = await provider.auth.apiKey?.login?.({
      prompt,
      signal: new AbortController().signal,
    } as unknown as ProviderAuthInteraction);
    expect(prompt).toHaveBeenCalledWith({
      type: "secret",
      message: "Enter Edgee API key",
    });
    expect(credential).toEqual({ type: "api_key", key: "entered-key" });
  });
});

describe("refreshModels", () => {
  it("fetches, persists, and publishes the refreshed catalog", async () => {
    const createClient = vi.fn(() => ({}) as never);
    const { provider, fetchModels } = createProvider({ createClient });

    const context = createContext({
      credential: { type: "api_key", key: "refresh-key" },
    });
    await provider.refreshModels?.(context);

    expect(createClient).toHaveBeenCalledWith("refresh-key");
    expect(fetchModels).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      undefined,
    );
    expect(context.publish).toHaveBeenCalledTimes(1);
    const publication = context.publish.mock.calls[0]?.[0];
    expect(publication.persist).toMatchObject({
      models: [
        expect.objectContaining({
          id: fetchedConfig.id,
          provider: EDGEE_PROVIDER_ID,
          headers: EDGEE_ATTRIBUTION_HEADERS,
        }),
      ],
    });
    const live = provider.getModels();
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({
      id: fetchedConfig.id,
      provider: EDGEE_PROVIDER_ID,
      api: "openai-completions",
      baseUrl: EDGEE_PROVIDER_BASE_URL,
      headers: EDGEE_ATTRIBUTION_HEADERS,
    });
  });

  it("adopts a fresh stored catalog without fetching", async () => {
    const { provider, fetchModels } = createProvider();

    const context = createContext({
      stored: storedEntry([storedConfig]),
    });
    await provider.refreshModels?.(context);

    expect(fetchModels).not.toHaveBeenCalled();
    expect(context.publish).toHaveBeenCalledTimes(1);
    expect(context.publish.mock.calls[0]?.[0].persist).toBeUndefined();
    expect(provider.getModels().map((model) => model.id)).toEqual([
      storedConfig.id,
    ]);
  });

  it("restores the stored catalog in offline phases without fetching", async () => {
    const { provider, fetchModels } = createProvider();

    await provider.refreshModels?.(
      createContext({
        allowNetwork: false,
        stored: storedEntry([storedConfig]),
      }),
    );

    expect(fetchModels).not.toHaveBeenCalled();
    expect(provider.getModels().map((model) => model.id)).toEqual([
      storedConfig.id,
    ]);
  });

  it("refreshes when the store entry has no checkedAt (fail-open)", async () => {
    const { provider, fetchModels } = createProvider();
    const undated = { models: [storedConfig] } as unknown as ModelsStoreEntry;

    await provider.refreshModels?.(createContext({ stored: undated }));

    expect(fetchModels).toHaveBeenCalledTimes(1);
    expect(provider.getModels().map((model) => model.id)).toEqual([
      fetchedConfig.id,
    ]);
  });

  it("refreshes past a stale store entry", async () => {
    const { provider, fetchModels } = createProvider();
    const stale = storedEntry([storedConfig], 5 * 60 * 60 * 1000);

    await provider.refreshModels?.(createContext({ stored: stale }));

    expect(fetchModels).toHaveBeenCalledTimes(1);
    expect(provider.getModels().map((model) => model.id)).toEqual([
      fetchedConfig.id,
    ]);
  });

  it("never throws without a key: an anonymous fetch failure keeps the stored catalog", async () => {
    const { provider } = createProvider({
      fetchModels: async () => {
        throw new Error("HTTP 401");
      },
    });

    const context = createContext({
      credential: { type: "api_key", key: "" },
      stored: storedEntry([storedConfig]),
      force: true,
    });
    await provider.refreshModels?.(context);

    expect(provider.getModels().map((model) => model.id)).toEqual([
      storedConfig.id,
    ]);
  });

  it("swallows fetch failures without a store without publishing", async () => {
    const { provider } = createProvider({
      fetchModels: async () => {
        throw new Error("network down");
      },
    });

    const context = createContext({
      credential: { type: "api_key", key: "" },
    });
    await provider.refreshModels?.(context);

    expect(context.publish).not.toHaveBeenCalled();
    expect(provider.getModels()).toEqual([]);
  });

  it("keeps the stored catalog when the gateway returns no models", async () => {
    const { provider } = createProvider({ fetchModels: async () => [] });

    await provider.refreshModels?.(
      createContext({ stored: storedEntry([storedConfig]) }),
    );

    expect(provider.getModels().map((model) => model.id)).toEqual([
      storedConfig.id,
    ]);
  });

  it("aborts without swapping the catalog when the signal aborts mid-flight", async () => {
    const controller = new AbortController();
    const { provider } = createProvider({
      fetchModels: async () => {
        controller.abort();
        return [fetchedConfig];
      },
    });

    await expect(
      provider.refreshModels?.(
        createContext({ signal: controller.signal, force: true }),
      ),
    ).rejects.toThrow();

    expect(provider.getModels()).toEqual([]);
  });
});

describe("streamSimple", () => {
  it("delegates to the openai-completions streamSimple injecting attribution and session headers", () => {
    const result = { marker: true };
    const baseStreamSimple = vi.fn(() => result) as never;
    const { provider } = createProvider({ baseStreamSimple });

    const model = { id: "openai/gpt-5.2" } as never;
    const context = {} as never;
    const returned = provider.streamSimple(model, context, {
      headers: { "x-custom": "1" },
      sessionId: "session-1",
    });

    expect(returned).toBe(result);
    expect(baseStreamSimple).toHaveBeenCalledWith(model, context, {
      headers: {
        ...EDGEE_ATTRIBUTION_HEADERS,
        "x-custom": "1",
        [EDGEE_SESSION_ID_HEADER]: "session-1",
      },
      sessionId: "session-1",
    });
  });
});
