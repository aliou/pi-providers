import type {
  Api,
  Model,
  Provider,
  ProviderStreamOptions,
} from "@earendil-works/pi-ai";
import { stream, streamSimple } from "@earendil-works/pi-ai/compat";
import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import { COHERE_API_KEY_ENV, FALLBACK_COHERE_MODELS } from "./models";
import {
  createCohereRefreshModels,
  type FetchCohereApiModels,
} from "./refresh-models";

export const COHERE_PROVIDER_ID = "cohere";
export const COHERE_BASE_URL = "https://api.cohere.ai/compatibility/v1";
export const COHERE_API = "openai-completions";

export type CohereProviderModel = Model<Api>;

function toProviderModels(
  models: ProviderModelConfig[],
): CohereProviderModel[] {
  return models.map((model) => ({
    ...model,
    api: COHERE_API,
    provider: COHERE_PROVIDER_ID,
    baseUrl: COHERE_BASE_URL,
  }));
}

export function createCohereProvider(
  fetchApiModels: FetchCohereApiModels,
): Provider {
  let liveModels = toProviderModels(FALLBACK_COHERE_MODELS);
  const refreshCatalog = createCohereRefreshModels(fetchApiModels);

  return {
    id: COHERE_PROVIDER_ID,
    name: "Cohere",
    baseUrl: COHERE_BASE_URL,
    auth: {
      apiKey: {
        name: "Cohere API key",
        login: async (interaction) => ({
          type: "api_key",
          key: await interaction.prompt({
            type: "secret",
            message: "Enter Cohere API key",
          }),
        }),
        check: async ({ ctx, credential }) => {
          if (credential?.type === "api_key" && credential.key) {
            return { type: "api_key", source: "stored credential" };
          }
          if (await ctx.env(COHERE_API_KEY_ENV)) {
            return { type: "api_key", source: COHERE_API_KEY_ENV };
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
          const envKey = await ctx.env(COHERE_API_KEY_ENV);
          signal.throwIfAborted();
          if (envKey) {
            return { auth: { apiKey: envKey }, source: COHERE_API_KEY_ENV };
          }
          // Anonymous resolution: an empty key sends no Authorization header
          // (pi does the same for llama.cpp); refresh fails soft without a key.
          return { auth: { apiKey: "" }, source: "anonymous" };
        },
      },
    },
    getModels: () => liveModels,
    refreshModels: async (context) => {
      const refreshed = await refreshCatalog(context);
      // Fresh store: the refresh intentionally skipped the network; adopt the
      // persisted catalog anyway so getModels reflects it (statics otherwise).
      await context.publish({
        update: () => {
          liveModels = toProviderModels(refreshed);
        },
      });
    },
    stream: (model, context, options) =>
      stream(model, context, options as ProviderStreamOptions | undefined),
    streamSimple,
  };
}
