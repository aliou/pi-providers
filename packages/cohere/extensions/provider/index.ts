import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  COHERE_OVERFLOW_PATTERN,
  createCohereProvider,
  fetchCohereModels,
} from "../../src";

export default function (pi: ExtensionAPI) {
  pi.registerProvider(createCohereProvider(fetchCohereModels));

  pi.on("message_end", (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant") return;
    if (message.stopReason !== "error") return;
    if (message.provider !== "cohere" && ctx.model?.provider !== "cohere")
      return;

    const errorMessage = message.errorMessage ?? "";
    if (errorMessage.includes("context_length_exceeded")) return;
    if (!COHERE_OVERFLOW_PATTERN.test(errorMessage)) return;

    return {
      message: {
        ...message,
        errorMessage: `context_length_exceeded: ${errorMessage}`,
      },
    };
  });
}
