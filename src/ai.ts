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

/** Vendor config: createAi + list of model names (optional temperature). */
type VendorModels = {
  createAi: typeof createAnthropic | typeof createOpenAI | typeof createGoogleGenerativeAI;
  models: { name: string; temperature?: number }[];
};

/** AI_SDK models grouped by vendor. Add new models to the right vendor; new IDs (e.g. new Claude versions) also work via prefix fallback below. */
const AI_SDK_VENDORS: VendorModels[] = [
  {
    createAi: createAnthropic,
    models: [
      // Claude 5.x series (current)
      { name: "claude-fable-5-1" },
      { name: "claude-opus-5" },
      { name: "claude-sonnet-5" },
      { name: "claude-haiku-4-5-20251001" },
      { name: "claude-haiku-4-5" },
      // Claude 4.x series
      { name: "claude-sonnet-4-5" },
      { name: "claude-sonnet-4-5-20250929" },
      { name: "claude-opus-4-20250514" },
      { name: "claude-opus-4-1-20250805" },
      { name: "claude-sonnet-4-20250514" },
      // Claude 3.x series (legacy)
      { name: "claude-3-7-sonnet-20250219" },
      { name: "claude-3-5-sonnet-20241022" },
      { name: "claude-3-5-sonnet-20240620" },
    ],
  },
  {
    createAi: createOpenAI,
    models: [
      // GPT-6 series (current)
      { name: "gpt-6-astra", temperature: 1 },
      // GPT-5.6 series
      { name: "gpt-5.6-sol", temperature: 1 },
      { name: "gpt-5.6-terra", temperature: 1 },
      { name: "gpt-5.6-luna", temperature: 1 },
      // GPT-5 series
      { name: "gpt-5", temperature: 1 },
      { name: "gpt-5-mini", temperature: 1 },
      { name: "gpt-5-nano", temperature: 1 },
      // GPT-4.x series (legacy)
      { name: "gpt-4.1" },
      { name: "gpt-4.1-mini" },
      { name: "gpt-4o-mini" },
      // o-series reasoning models
      { name: "o4-mini", temperature: 1 },
      { name: "o3-mini", temperature: 1 },
      { name: "o3" },
      { name: "o1" },
      { name: "o1-mini" },
    ],
  },
  {
    createAi: createGoogleGenerativeAI,
    models: [
      // Gemini 3.x series (current): https://ai.google.dev/gemini-api/docs/models
      { name: "gemini-3.8-flash" },
      { name: "gemini-3.7-flash" },
      { name: "gemini-3.6-flash" },
      { name: "gemini-3.5-flash" },
      { name: "gemini-3.5-flash-lite" },
      { name: "gemini-3.1-pro" },
      { name: "gemini-3.1-flash" },
      // Gemini 3.x preview aliases (kept for forward compat)
      { name: "gemini-3-pro" },
      { name: "gemini-3-flash" },
      // Gemini 2.5 series (still active, retiring Oct 2026)
      { name: "gemini-2.5-pro" },
      { name: "gemini-2.5-flash" },
      { name: "gemini-2.5-flash-lite" },
      // Gemini 2.0 (legacy)
      { name: "gemini-2.0-flash" },
      { name: "gemini-2.0-flash-lite" },
    ],
  },
];

/**
 * Fallback for unknown model IDs so new major versions work without code changes:
 * - Anthropic: claude-*
 * - OpenAI: gpt-*, o1, o2, o3, o4, o5, ... (any o + digits + optional suffix)
 * - Google: gemini-* (covers Gemini 2.x, 3.x, etc.)
 */
type ModelMatcher = string[] | ((modelName: string) => boolean);
const AI_SDK_PREFIX_FALLBACK: [ModelMatcher, VendorModels["createAi"]][] = [
  [["claude-"], createAnthropic],
  [
    (name) => name.startsWith("gpt-") || /^o\d+(-|\.|$)/.test(name),
    createOpenAI,
  ],
  [["gemini-"], createGoogleGenerativeAI],
];

function resolveAISDKModel(modelName: string): ModelConfig | null {
  for (const vendor of AI_SDK_VENDORS) {
    const entry = vendor.models.find((m) => m.name === modelName);
    if (entry) {
      return { name: entry.name, createAi: vendor.createAi, temperature: entry.temperature };
    }
  }
  for (const [matcher, createAi] of AI_SDK_PREFIX_FALLBACK) {
    const matches =
      typeof matcher === "function"
        ? matcher(modelName)
        : matcher.some(
            (p) =>
              modelName === p ||
              modelName.startsWith(p + "-") ||
              modelName.startsWith(p + ".")
          );
    if (matches) {
      return { name: modelName, createAi };
    }
  }
  return null;
}

const SAP_AI_SDK_MODELS: string[] = [
  // Claude 5.x series
  "anthropic--claude-sonnet-5",
  "anthropic--claude-opus-5",
  "anthropic--claude-haiku-4-5",
  // Claude 4.x series
  "anthropic--claude-sonnet-4-5",
  // Claude 3.x series (legacy)
  "anthropic--claude-3.7-sonnet",
  "anthropic--claude-3.5-sonnet",
  "anthropic--claude-3-sonnet",
  "anthropic--claude-3-haiku",
  "anthropic--claude-3-opus",
  // OpenAI GPT-6 / 5.6 series
  "gpt-6-astra",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  // OpenAI GPT-5 series
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  // OpenAI legacy
  "gpt-4.1",
  "gpt-4.1-nano",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4",
  // o-series reasoning models
  "o4-mini",
  "o3",
  "o3-mini",
  "o1",
];

function getProviderModels(provider: AIProviderType): ModelConfig[] {
  if (provider === AIProviderType.AI_SDK) {
    return AI_SDK_VENDORS.flatMap((v) =>
      v.models.map((m) => ({ name: m.name, createAi: v.createAi, temperature: m.temperature }))
    );
  }
  return SAP_AI_SDK_MODELS.map((name) => ({ name }));
}

const LLM_MODELS: Record<AIProviderType, ModelConfig[]> = {
  [AIProviderType.AI_SDK]: getProviderModels(AIProviderType.AI_SDK),
  [AIProviderType.SAP_AI_SDK]: getProviderModels(AIProviderType.SAP_AI_SDK),
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
  const modelName = config.llmModel;
  if (!modelName) {
    throw new Error("LLM model is not configured (config.llmModel is missing).");
  }
  const providerType = config.llmProvider as AIProviderType;
  const providerModels = LLM_MODELS[providerType];
  // Use prefix-based fallback for AI_SDK (covers claude-*, gpt-*, gemini-*, etc.)
  // When using a custom base URL, skip whitelist validation and use OpenAI SDK directly
  let modelConfig =
    providerType === AIProviderType.AI_SDK
      ? resolveAISDKModel(modelName)
      : providerModels.find((m) => m.name === modelName);

  if (!modelConfig && config.llmBaseUrl && providerType === AIProviderType.AI_SDK) {
    modelConfig = {
      name: modelName,
      createAi: createOpenAI,
    };
  }
  if (!modelConfig) {
    throw new Error(
      `Unknown LLM model: ${modelName}. For provider ${
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
