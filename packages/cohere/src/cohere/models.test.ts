import { describe, expect, it } from "vitest";
import {
  buildCohereModels,
  FALLBACK_COHERE_MODELS,
  fetchCohereModels,
  MODEL_OVERRIDES,
} from "./models";

interface ModelsDevModel {
  id: string;
  name: string;
  reasoning?: boolean;
  modalities?: {
    input?: string[];
  };
  limit?: {
    context?: number;
    output?: number;
  };
  cost?: {
    input?: number;
    output?: number;
  };
}

interface ModelsDevProvider {
  models: Record<string, ModelsDevModel>;
}

async function fetchModelsDevCohere(): Promise<ModelsDevProvider> {
  const response = await fetch("https://models.dev/api.json", {
    headers: { "User-Agent": "@aliou/pi-cohere tests" },
  });
  if (!response.ok) {
    throw new Error(
      `models.dev request failed: ${response.status} ${response.statusText}`,
    );
  }

  const responseBody = await response.json();
  const payload = responseBody as Record<string, ModelsDevProvider>;
  const cohere = payload.cohere;
  if (!cohere) throw new Error("models.dev response does not include cohere");
  return cohere;
}

function expectCostsClose(
  actual: { input: number; output: number },
  expected: { input?: number; output?: number },
): void {
  const epsilon = 0.0001;
  if (expected.input !== undefined) {
    expect(Math.abs(actual.input - expected.input)).toBeLessThanOrEqual(
      epsilon,
    );
  }
  if (expected.output !== undefined) {
    expect(Math.abs(actual.output - expected.output)).toBeLessThanOrEqual(
      epsilon,
    );
  }
}

describe("Cohere models", () => {
  it("keeps hardcoded fallback models valid", () => {
    const ids = FALLBACK_COHERE_MODELS.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const model of FALLBACK_COHERE_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.input).toContain("text");
      expect(model.contextWindow).toBeGreaterThan(0);
      expect(model.maxTokens).toBeGreaterThan(0);
      expect(model.cost.input).toBeGreaterThanOrEqual(0);
      expect(model.cost.output).toBeGreaterThanOrEqual(0);
      expect(model.compat).toMatchObject({
        maxTokensField: "max_tokens",
        supportsUsageInStreaming: true,
      });
      if (model.reasoning) {
        expect(model.thinkingLevelMap).toEqual({
          off: "none",
          minimal: null,
          low: null,
          medium: "high",
          high: null,
          xhigh: null,
        });
      }
    }
  });

  it("keeps known prices and limits in sync with models.dev", async () => {
    const cohere = await fetchModelsDevCohere();

    for (const [modelId, override] of Object.entries(MODEL_OVERRIDES)) {
      const apiModel = cohere.models[modelId];
      expect(apiModel, `${modelId} is missing from models.dev`).toBeDefined();

      if (override.cost && apiModel.cost) {
        expectCostsClose(override.cost, apiModel.cost);
      }

      if (override.maxTokens !== undefined && apiModel.limit?.output) {
        expect(override.maxTokens).toBe(apiModel.limit.output);
      }
    }
  });

  it("maps models.dev Cohere metadata into provider models", async () => {
    const cohere = await fetchModelsDevCohere();
    const apiModels = Object.values(cohere.models).map((model) => ({
      name: model.id,
      endpoints: ["chat"],
      context_length: model.limit?.context,
      features: [
        ...(model.reasoning ? ["reasoning"] : []),
        ...(model.modalities?.input?.includes("image") ? ["vision"] : []),
      ],
    }));

    const mapped = buildCohereModels(apiModels);

    for (const apiModel of Object.values(cohere.models)) {
      const model = mapped.find((entry) => entry.id === apiModel.id);
      expect(
        model,
        `${apiModel.id} is missing from mapped models`,
      ).toBeDefined();
      if (!model) continue;

      if (apiModel.limit?.context) {
        expect(model.contextWindow).toBe(apiModel.limit.context);
      }
      if (apiModel.limit?.output) {
        expect(model.maxTokens).toBe(apiModel.limit.output);
      }
      if (apiModel.cost) {
        expectCostsClose(model.cost, apiModel.cost);
      }
    }
  });

  it.skipIf(!process.env.COHERE_API_KEY)(
    "can fetch Cohere API models with COHERE_API_KEY",
    { timeout: 30000 },
    async () => {
      const models = await fetchCohereModels(process.env.COHERE_API_KEY ?? "");
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((model) => model.id === "command-a-03-2025")).toBe(
        true,
      );
    },
  );
});
