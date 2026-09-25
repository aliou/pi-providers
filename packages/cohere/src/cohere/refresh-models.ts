// refreshModels implementation for the Cohere model catalog.
// Restores from a stored snapshot, refreshes from the Cohere models API on a
// 4-hour TTL, and persists fetched catalogs through context.publish().
// Falls back to the stored/static catalog when offline, unauthenticated, or
// the fetch fails — the Cohere catalog endpoint requires an API key, so
// missing auth must fail soft rather than throw.

import type { RefreshModelsContext } from "@earendil-works/pi-ai";
import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import { FALLBACK_COHERE_MODELS } from "./models";
import type { CohereProviderModel } from "./provider";
import { mergeCohereModels } from "./provider-models";

export const MODEL_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export type FetchCohereApiModels = (
  apiKey: string,
  signal?: AbortSignal,
) => Promise<ProviderModelConfig[]>;

const COHERE_API = "openai-completions";
const COHERE_BASE_URL = "https://api.cohere.ai/compatibility/v1";
const COHERE_PROVIDER_ID = "cohere";

function isModelCacheFresh(checkedAt: number | undefined): boolean {
  return checkedAt !== undefined && Date.now() - checkedAt < MODEL_CACHE_TTL_MS;
}

function toStoredModels(models: ProviderModelConfig[]): CohereProviderModel[] {
  return models.map((model) => ({
    ...model,
    api: COHERE_API,
    provider: COHERE_PROVIDER_ID,
    baseUrl: COHERE_BASE_URL,
  }));
}

function fromStoredModels(models: readonly unknown[]): ProviderModelConfig[] {
  return models.map((model) => {
    const {
      api: _api,
      baseUrl: _baseUrl,
      provider: _provider,
      ...providerModel
    } = model as ProviderModelConfig & { provider?: string };
    return providerModel;
  });
}

export function createCohereRefreshModels(
  fetchApiModels: FetchCohereApiModels,
) {
  const fallback = FALLBACK_COHERE_MODELS;

  const fromStore = (
    context: RefreshModelsContext,
  ): ProviderModelConfig[] | undefined =>
    context.stored && context.stored.models.length > 0
      ? mergeCohereModels(fromStoredModels(context.stored.models), fallback)
      : undefined;

  return async (
    context: RefreshModelsContext,
  ): Promise<ProviderModelConfig[]> => {
    context.signal.throwIfAborted();
    if (!context.allowNetwork) {
      return fromStore(context) ?? fallback;
    }
    if (!context.force && isModelCacheFresh(context.stored?.checkedAt)) {
      return fromStore(context) ?? fallback;
    }

    const apiKey =
      context.credential?.type === "api_key" && context.credential.key
        ? context.credential.key
        : undefined;
    if (!apiKey) {
      return fromStore(context) ?? fallback;
    }

    try {
      const remoteModels = await fetchApiModels(apiKey, context.signal);
      context.signal.throwIfAborted();
      const models = mergeCohereModels(remoteModels, fallback);
      // Cache persistence is best-effort.
      await context
        .publish({
          persist: { models: toStoredModels(models), checkedAt: Date.now() },
        })
        .catch(() => undefined);
      context.signal.throwIfAborted();
      return models;
    } catch (error) {
      if (
        context.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw error;
      }
      return fromStore(context) ?? fallback;
    }
  };
}
