import { AIProvider, InferenceConfig } from "@/ai";
import config from "../config";
import { info } from "@actions/core";
import { generateObject } from "ai";

export class AISDKProvider implements AIProvider {
  private createAiFunc: any;
  private modelName: string;

  constructor(createAiFunc: any, modelName: string) {
    this.createAiFunc = createAiFunc;
    this.modelName = modelName;
  }

  async runInference({
    prompt,
    temperature,
    system,
    schema,
  }: InferenceConfig): Promise<any> {
    const isOpenRouter = Boolean(config.llmBaseUrl?.includes("openrouter.ai"));
    const isCustomOpenAI = Boolean(
      config.llmBaseUrl &&
        !config.llmBaseUrl.includes("anthropic") &&
        !config.llmBaseUrl.includes("google") &&
        !config.llmBaseUrl.includes("generativelanguage")
    );

    const providerOptions: Record<string, any> = {
      apiKey: config.llmApiKey,
      ...(config.llmBaseUrl && { baseURL: config.llmBaseUrl }),
    };

    if (isCustomOpenAI) {
      providerOptions.compatibility = "compatible";
    }

    if (isOpenRouter) {
      providerOptions.headers = {
        ...(providerOptions.headers || {}),
        "HTTP-Referer": "https://presubmit.ai",
        "X-Title": "Presubmit.ai",
      };
    }

    const llm = this.createAiFunc(providerOptions);
    try {
      const { object, usage } = await generateObject({
        model: llm(this.modelName),
        prompt,
        temperature: temperature || 0,
        system,
        schema,
      });

      if (process.env.DEBUG) {
        info(`usage: \n${JSON.stringify(usage, null, 2)}`);
      }

      return object;
    } catch (error: any) {
      // If the model wrapped the payload in a placeholder key (e.g. Claude returning {"$PARAMETER_NAME": ...}),
      // extract and validate the inner payload before failing.
      const val = error?.value;
      if (val && typeof val === "object") {
        const candidate =
          val["$PARAMETER_NAME"] ??
          (Object.keys(val).length === 1 ? Object.values(val)[0] : null);
        if (candidate && typeof candidate === "object") {
          const parsed = schema.safeParse(candidate);
          if (parsed.success) {
            return parsed.data;
          }
        }
      }

      // Actionable diagnostics for HTTP errors
      const statusCode = error?.statusCode ?? error?.status;
      if (statusCode === 401) {
        if (isOpenRouter) {
          console.error(
            "Authentication failed for OpenRouter (HTTP 401). Please check that LLM_API_KEY (or OPEN_ROUTER_API_KEY) is valid."
          );
        } else {
          console.error(
            `Authentication failed (HTTP 401). Please verify that LLM_API_KEY is correct for ${
              config.llmBaseUrl || "the configured provider"
            }.`
          );
        }
      } else if (statusCode === 402) {
        console.error(
          "Payment required / insufficient credits (HTTP 402). If using OpenRouter, please check your credit balance at https://openrouter.ai/credits."
        );
      } else if (statusCode === 404) {
        if (isOpenRouter) {
          console.error(
            `Model '${this.modelName}' not found on OpenRouter (HTTP 404). Please verify the model ID at https://openrouter.ai/models (e.g., 'anthropic/claude-sonnet-4.5').`
          );
        } else {
          console.error(`Model '${this.modelName}' not found (HTTP 404).`);
        }
      } else if (statusCode === 429) {
        console.error(
          "Rate limit exceeded (HTTP 429). Please wait before retrying or check your provider quota."
        );
      }

      throw error;
    }
  }
}
