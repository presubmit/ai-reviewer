import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import config from "./config";
import { AISDKProvider } from "./providers/ai-sdk";
import { SAPAIProvider } from "./providers/sapaicore";

export enum AIProviderType {
  AI_SDK = "ai-sdk",
  SAP_AI_SDK = "sap-ai-sdk",
}

const LLM_MODELS: Record<AIProviderType, ModelConfig[]> = {
  [AIProviderType.AI_SDK]: [
    // Anthropic - https://platform.claude.com/docs/en/about-claude/models/overview
    {
      name: "claude-3-5-haiku-20241022",
      createAi: createAnthropic,
    },
    {
      name: "claude-3-5-haiku-latest",
      createAi: createAnthropic,
    },
    {
      name: "claude-3-7-sonnet-20250219",
      createAi: createAnthropic,
    },
    {
      name: "claude-3-7-sonnet-latest",
      createAi: createAnthropic,
    },
    {
      name: "claude-sonnet-4-20250514",
      createAi: createAnthropic,
    },
    {
      name: "claude-sonnet-4-0",
      createAi: createAnthropic,
    },
    {
      name: "claude-opus-4-20250514",
      createAi: createAnthropic,
    },
    {
      name: "claude-opus-4-0",
      createAi: createAnthropic,
    },
    {
      name: "claude-opus-4-1-20250805",
      createAi: createAnthropic,
    },
    {
      name: "claude-opus-4-1",
      createAi: createAnthropic,
    },
    {
      name: "claude-haiku-4-5-20251001",
      createAi: createAnthropic,
    },
    {
      name: "claude-haiku-4-5",
      createAi: createAnthropic,
    },
    {
      name: "claude-sonnet-4-5-20250929",
      createAi: createAnthropic,
    },
    {
      name: "claude-sonnet-4-5",
      createAi: createAnthropic,
    },
    {
      name: "claude-opus-4-5-20251101",
      createAi: createAnthropic,
    },
    {
      name: "claude-opus-4-5",
      createAi: createAnthropic,
    },
    // OpenAI - https://platform.openai.com/docs/models
    {
      name: "gpt-5.2",
      createAi: createOpenAI,
    },
    {
      name: "gpt-5.2-pro",
      createAi: createOpenAI,
    },
    {
      name: "gpt-5.1",
      createAi: createOpenAI,
    },
    {
      name: "gpt-5.1-codex",
      createAi: createOpenAI,
    },
    {
      name: "gpt-5.1-codex-max",
      createAi: createOpenAI,
    },
    {
      name: "gpt-5-codex",
      createAi: createOpenAI,
    },
    {
      name: "gpt-5-pro",
      createAi: createOpenAI,
    },
    {
      name: "gpt-5",
      createAi: createOpenAI,
    },
    {
      name: "gpt-5-mini",
      createAi: createOpenAI,
    },
    {
      name: "gpt-5-nano",
      createAi: createOpenAI,
    },
    {
      name: "gpt-4.1-mini",
      createAi: createOpenAI,
    },
    {
      name: "gpt-4o-mini",
      createAi: createOpenAI,
    },
    {
      name: "o1",
      createAi: createOpenAI,
    },
    {
      name: "o1-mini",
      createAi: createOpenAI,
    },
    {
      name: "o3-mini",
      createAi: createOpenAI,
    },
    {
      name: "o4-mini",
      createAi: createOpenAI,
    },
    {
      name: "gpt-4.1",
      createAi: createOpenAI,
    },
    // Google stable models https://ai.google.dev/gemini-api/docs/models/gemini
    {
      name: "gemini-2.0-flash-lite",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.0-flash",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.5-flash-lite",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.5-flash",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.5-pro",
      createAi: createGoogleGenerativeAI,
    },
    // Google experimental models https://ai.google.dev/gemini-api/docs/models/experimental-models
    {
      name: "gemini-2.5-flash-lite-preview-09-2025",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-2.5-flash-preview-09-2025",
      createAi: createGoogleGenerativeAI,
    },
    {
      name: "gemini-3-pro-preview",
      createAi: createGoogleGenerativeAI,
    }
  ],
  [AIProviderType.SAP_AI_SDK]: [
    {
      name: "anthropic--claude-3.7-sonnet",
    },
    {
      name: "anthropic--claude-3.5-sonnet",
    },
    {
      name: "anthropic--claude-3-sonnet",
    },
    {
      name: "anthropic--claude-3-haiku",
    },
    {
      name: "anthropic--claude-3-opus",
    },
    {
      name: "gpt-4o",
    },
    {
      name: "gpt-4",
    },
    {
      name: "gpt-4o-mini",
    },
    {
      name: "o1",
    },
    {
      name: "gpt-4.1",
    },
    {
      name: "gpt-4.1-nano",
    },
    {
      name: "gpt-5",
    },
    {
      name: "gpt-5-mini",
    },
    {
      name: "gpt-5-nano",
    },
    {
      name: "o3-mini",
    },
    {
      name: "o3",
    },
    {
      name: "o4-mini",
    },
  ],
};

export type InferenceConfig = {
  prompt: string;
  temperature?: number;
  system?: string;
  schema: z.ZodObject<any, any>;
};

export interface AIProvider {
  runInference(params: InferenceConfig): Promise<any>;
}

class AIProviderFactory {
  static getProvider(
    provider: AIProviderType,
    modelConfig: ModelConfig
  ): AIProvider {
    switch (provider) {
      case AIProviderType["AI_SDK"]:
        if (!modelConfig.createAi) {
          throw new Error(
            `No createAi function found for model ${modelConfig.name}`
          );
        }
        return new AISDKProvider(modelConfig.createAi, modelConfig.name);
      case AIProviderType["SAP_AI_SDK"]:
        return new SAPAIProvider(modelConfig.name);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}

type ModelConfig = {
  name: string;
  createAi?: any;
  temperature?: number;
};

export async function runPrompt({
  prompt,
  systemPrompt,
  schema,
}: {
  prompt: string;
  systemPrompt?: string;
  schema: z.ZodObject<any, any>;
}) {
  if (
    !Object.values(AIProviderType).includes(
      config.llmProvider as AIProviderType
    )
  ) {
    throw new Error(
      `Unknown LLM provider: ${
        config.llmProvider
      }. Valid providers are: ${Object.keys(AIProviderType).join(", ")}`
    );
  }
  const providerType = config.llmProvider as AIProviderType;
  const providerModels = LLM_MODELS[providerType];
  let modelConfig = providerModels.find((m) => m.name === config.llmModel);

  // When using a custom base URL, skip whitelist validation and use OpenAI SDK
  if (!modelConfig && config.llmBaseUrl && providerType === AIProviderType.AI_SDK) {
    modelConfig = {
      name: config.llmModel!,
      createAi: createOpenAI,
    };
  }

  if (!modelConfig) {
    throw new Error(
      `Unknown LLM model: ${config.llmModel}. For provider ${
        config.llmProvider
      }, supported models are: ${providerModels.map((m) => m.name).join(", ")}`
    );
  }

  // Get the appropriate provider for this model
  const provider = AIProviderFactory.getProvider(providerType, modelConfig);

  // Run the inference using the provider
  return await provider.runInference({
    prompt,
    temperature: modelConfig.temperature,
    system: systemPrompt,
    schema,
  });
}
