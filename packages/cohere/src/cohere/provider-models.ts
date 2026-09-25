import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

export function mergeCohereModels(
  remoteModels: ProviderModelConfig[],
  fallbackModels: ProviderModelConfig[],
): ProviderModelConfig[] {
  const byId = new Map(remoteModels.map((model) => [model.id, model]));

  for (const fallback of fallbackModels) {
    if (!byId.has(fallback.id)) byId.set(fallback.id, fallback);
  }

  return Array.from(byId.values());
}
