import type {
  Api,
  Context,
  Model,
  ModelsStoreEntry,
  Provider,
  ProviderStreamOptions,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { stream, streamSimple } from "@earendil-works/pi-ai/compat";
import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import type { BuiltInModelLookup, EdgeeClient } from "../../src";
import {
  EDGEE_API_KEY_ENV,
  EDGEE_ATTRIBUTION_HEADERS,
  EDGEE_PROVIDER_BASE_URL,
  EDGEE_PROVIDER_ID,
  EDGEE_PROVIDER_NAME,
  EDGEE_SESSION_ID_HEADER,
} from "../../src";

const MODEL_STORE_TTL_MS = 4 * 60 * 60 * 1000;

export interface EdgeeProviderDeps {
  createClient: (apiKey: string) => EdgeeClient;
  fetchModels: (
    client: EdgeeClient,
    signal?: AbortSignal,
    lookup?: BuiltInModelLookup,
  ) => Promise<ProviderModelConfig[]>;
  createLookup: (
    cachedModels: ProviderModelConfig[],
  ) => BuiltInModelLookup | undefined;
  baseStreamSimple?: (
    model: Model<Api>,
    context: Context,
    options: SimpleStreamOptions,
  ) => ReturnType<typeof streamSimple>;
}

function isFreshStoreEntry(
  entry: Readonly<ModelsStoreEntry> | undefined,
): entry is ModelsStoreEntry {
  if (!entry) return false;
  // No timestamp: fail-open to a refetch rather than freezing the catalog.
  if (entry.checkedAt === undefined) return false;
  return Date.now() - entry.checkedAt < MODEL_STORE_TTL_MS;
}

function toProviderModel(config: ProviderModelConfig): Model<Api> {
  return {
    ...config,
    id: config.id,
    name: config.name,
    provider: EDGEE_PROVIDER_ID,
    api: config.api ?? "openai-completions",
    baseUrl: config.baseUrl ?? EDGEE_PROVIDER_BASE_URL,
    headers: { ...EDGEE_ATTRIBUTION_HEADERS, ...config.headers },
  };
}

/** Assemble the Edgee provider as a full pi-ai `Provider`. */
export function createEdgeeProvider(deps: EdgeeProviderDeps): Provider {
  let liveModels: Model<Api>[] = [];
  const baseStreamSimple = deps.baseStreamSimple;

  return {
    id: EDGEE_PROVIDER_ID,
    name: EDGEE_PROVIDER_NAME,
    baseUrl: EDGEE_PROVIDER_BASE_URL,
    headers: EDGEE_ATTRIBUTION_HEADERS,
    auth: {
      apiKey: {
        name: "Edgee API key",
        login: async (interaction) => ({
          type: "api_key",
          key: await interaction.prompt({
            type: "secret",
            message: "Enter Edgee API key",
          }),
        }),
        check: async ({ ctx, credential }) => {
          if (credential?.type === "api_key" && credential.key) {
            return { type: "api_key", source: "stored credential" };
          }
          if (await ctx.env(EDGEE_API_KEY_ENV)) {
            return { type: "api_key", source: EDGEE_API_KEY_ENV };
          }
          return undefined;
        },
        resolve: async ({ ctx, credential, signal }) => {
          signal.throwIfAborted();
          if (credential?.type === "api_key" && credential.key) {
            return {
              auth: { apiKey: credential.key },
              env: credential.env,
              source: "stored credential",
            };
          }
          const envKey = await ctx.env(EDGEE_API_KEY_ENV);
          signal.throwIfAborted();
          if (envKey) {
            return { auth: { apiKey: envKey }, source: EDGEE_API_KEY_ENV };
          }
          // Anonymous resolution: an empty key carries no Authorization
          // header; the catalog endpoint is public, so model refresh works
          // without credentials.
          return { auth: { apiKey: "" }, source: "anonymous" };
        },
      },
    },
    getModels: () => liveModels,
    refreshModels: async (context) => {
      context.signal.throwIfAborted();
      const mayFetch =
        context.allowNetwork &&
        (context.force || !isFreshStoreEntry(context.stored)) &&
        !context.signal.aborted;
      let fetched: Model<Api>[] | undefined;
      let persist: ModelsStoreEntry | undefined;

      if (mayFetch) {
        try {
          const apiKey =
            context.credential?.type === "api_key"
              ? (context.credential.key ?? "")
              : "";
          const client = deps.createClient(apiKey);
          const cached = [...(context.stored?.models ?? [])];
          const models = await deps.fetchModels(
            client,
            context.signal,
            deps.createLookup(cached),
          );
          context.signal.throwIfAborted();
          if (models.length > 0) {
            fetched = models.map(toProviderModel);
            persist = { models: fetched, checkedAt: Date.now() };
          }
        } catch (error) {
          // A fetch failure degrades to the stored catalog; only aborts
          // propagate.
          if (
            context.signal.aborted ||
            (error instanceof Error && error.name === "AbortError")
          ) {
            throw error;
          }
        }
      }

      // Fresh store (network skipped) or failed fetch: adopt the stored
      // catalog into the live list (pi remote-catalog overlay pattern).
      const next =
        fetched ??
        (context.stored && context.stored.models.length > 0
          ? context.stored.models.map((model) =>
              toProviderModel(model as ProviderModelConfig),
            )
          : undefined);
      if (!next) return;
      await context.publish({
        persist,
        update: () => {
          liveModels = next;
        },
      });
    },
    stream: (model, context, options) =>
      stream(model, context, options as ProviderStreamOptions | undefined),
    streamSimple: baseStreamSimple
      ? (model, context, options = {}) =>
          baseStreamSimple(model, context, {
            ...options,
            headers: {
              ...EDGEE_ATTRIBUTION_HEADERS,
              ...options.headers,
              [EDGEE_SESSION_ID_HEADER]: options.sessionId ?? "",
            },
          })
      : streamSimple,
  };
}
