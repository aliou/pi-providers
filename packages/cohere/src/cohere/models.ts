import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

export const COHERE_API_KEY_ENV = "COHERE_API_KEY";

export interface CohereApiModel {
  name: string;
  endpoints?: string[];
  context_length?: number;
  features?: string[] | null;
}

const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_COMPAT = {
  maxTokensField: "max_tokens" as const,
  supportsUsageInStreaming: true,
};

// Pricing and output limits from https://models.dev/api.json (provider: cohere).
// Models without pricing in models.dev keep a zero cost fallback.
export const MODEL_OVERRIDES: Record<
  string,
  Partial<Pick<ProviderModelConfig, "cost" | "maxTokens">>
> = {
  "command-a-plus-05-2026": {
    cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 64000,
  },
  "command-a-03-2025": {
    cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 8000,
  },
  "command-a-reasoning-08-2025": {
    cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 32000,
  },
  "command-a-vision-07-2025": {
    cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 8000,
  },
  "command-r-plus-08-2024": {
    cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 4000,
  },
  "command-a-translate-08-2025": {
    cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 8000,
  },
  "command-r-08-2024": {
    cost: { input: 0.15, output: 0.6, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 4000,
  },
  "command-r7b-12-2024": {
    cost: { input: 0.0375, output: 0.15, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 4000,
  },
  "command-r7b-arabic-02-2025": {
    cost: { input: 0.0375, output: 0.15, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 4000,
  },
  "north-mini-code-1-0": {
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 64000,
  },
};

function cohereModelConfig(
  model: Pick<CohereApiModel, "name" | "context_length" | "features">,
): ProviderModelConfig {
  const features = new Set(model.features ?? []);
  const input: ProviderModelConfig["input"] = features.has("vision")
    ? ["text", "image"]
    : ["text"];
  const override = MODEL_OVERRIDES[model.name];

  const reasoning = features.has("reasoning");

  return {
    id: model.name,
    name: formatModelName(model.name),
    reasoning,
    thinkingLevelMap: reasoning
      ? {
          off: "none",
          minimal: null,
          low: null,
          medium: "high",
          high: null,
          xhigh: null,
        }
      : undefined,
    input,
    cost: override?.cost ?? {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: model.context_length ?? 128000,
    maxTokens: override?.maxTokens ?? DEFAULT_MAX_TOKENS,
    compat: DEFAULT_COMPAT,
  } satisfies ProviderModelConfig;
}

export const FALLBACK_COHERE_MODELS: ProviderModelConfig[] = [
  cohereModelConfig({
    name: "command-a-plus-05-2026",
    context_length: 436000,
    features: ["reasoning", "vision"],
  }),
  cohereModelConfig({
    name: "command-a-reasoning-08-2025",
    context_length: 288768,
    features: ["reasoning"],
  }),
  cohereModelConfig({
    name: "command-a-03-2025",
    context_length: 288000,
    features: [],
  }),
  cohereModelConfig({
    name: "command-r-plus-08-2024",
    context_length: 128000,
    features: [],
  }),
  cohereModelConfig({
    name: "command-r-08-2024",
    context_length: 128000,
    features: [],
  }),
  cohereModelConfig({
    name: "command-r7b-12-2024",
    context_length: 132000,
    features: [],
  }),
  cohereModelConfig({
    name: "north-mini-code-1-0",
    context_length: 256000,
    features: ["reasoning"],
  }),
];

function formatModelName(id: string): string {
  return id
    .split("-")
    .filter((part) => !/^\d{2,4}$/.test(part))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isChatModel(model: CohereApiModel): boolean {
  return model.endpoints?.includes("chat") ?? false;
}

export function buildCohereModels(
  models: CohereApiModel[],
): ProviderModelConfig[] {
  const built = models.filter(isChatModel).map(cohereModelConfig);
  return built.length > 0 ? built : FALLBACK_COHERE_MODELS;
}

export async function fetchCohereModels(
  apiKey: string,
  signal?: AbortSignal,
): Promise<ProviderModelConfig[]> {
  const response = await fetch("https://api.cohere.com/v1/models", {
    headers: {
      accept: "application/json",
      Authorization: `bearer ${apiKey}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Cohere models request failed: ${response.status} ${await response.text()}`,
    );
  }

  const responseBody = await response.json();
  const payload = responseBody as { models?: CohereApiModel[] };
  return buildCohereModels(payload.models ?? []);
}
