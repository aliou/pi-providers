import { getApiProvider } from "@earendil-works/pi-ai/compat";
import type {
  ExtensionAPI,
  ExtensionContext,
  ModelRegistry,
} from "@earendil-works/pi-coding-agent";
import {
  type BuiltInModelLookup,
  createEdgeeLookup,
  EDGEE_OVERFLOW_PATTERN,
  EDGEE_PROVIDER_ID,
  EdgeeClient,
  fetchEdgeeModels,
} from "../../src";
import { createEdgeeProvider } from "./provider";

export default async function (pi: ExtensionAPI) {
  let latestRegistry: ModelRegistry | undefined;
  const base = getApiProvider("openai-completions")?.streamSimple;

  pi.registerProvider(
    createEdgeeProvider({
      createClient: (apiKey) => new EdgeeClient({ apiKey }),
      fetchModels: fetchEdgeeModels,
      createLookup: (cachedModels): BuiltInModelLookup | undefined =>
        latestRegistry
          ? createEdgeeLookup(latestRegistry, cachedModels)
          : undefined,
      baseStreamSimple: base,
    }),
  );

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    latestRegistry = ctx.modelRegistry;
  });

  pi.on("message_end", (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant") return;
    if (message.stopReason !== "error") return;
    if (
      message.provider !== EDGEE_PROVIDER_ID &&
      ctx.model?.provider !== EDGEE_PROVIDER_ID
    ) {
      return;
    }

    const errorMessage = message.errorMessage ?? "";
    if (errorMessage.includes("context_length_exceeded")) return;
    if (!EDGEE_OVERFLOW_PATTERN.test(errorMessage)) return;

    return {
      message: {
        ...message,
        errorMessage: `context_length_exceeded: ${errorMessage}`,
      },
    };
  });
}
