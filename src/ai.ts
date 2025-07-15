import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import config from "./config"; // Assuming a config file exists
import { AISDKProvider } from "./providers/ai-sdk";
import { SAPAIProvider } from "./providers/sapaicore";

// --- Configuration & Type Definitions ---

/**
 * Defines the available AI provider types.
 * Using a string enum for better readability and debugging.
 */
export enum AIProviderType {
  AI_SDK = "ai-sdk",
  SAP_AI_SDK = "sap-ai-sdk",
}

/**
 * Defines the structure for a single AI model's configuration.
 */
interface ModelConfig {
  name: string;
  createAi?: (options?: any) => any; // Function to create an AI instance for AI-SDK
  temperature?: number;
}

/**
 * Defines the structure for configuring different AI vendors within the AI-SDK provider.
 */
interface AiSdkVendorConfig {
  createAi: (options?: any) => any;
  models: string[];
}

/**
 * Defines the parameters for running an inference task.
 */
export interface InferenceConfig {
  prompt: string;
  schema: z.ZodObject<any, any>;
  system?: string;
  temperature?: number;
}

/**
 * Defines the interface that all AI providers must implement.
 */
export interface AIProvider {
  runInference(params: InferenceConfig): Promise<any>;
}


// --- Model and Provider Mapping ---

/**
 * Centralized configuration for AI-SDK models, grouped by vendor.
 * This structure is more organized and avoids repeating the `createAi` function.
 */
const AI_SDK_VENDORS: Record<string, AiSdkVendorConfig> = {
  anthropic: {
    createAi: createAnthropic,
    models: [
      "claude-3-5-sonnet-20240620",
      "claude-3-5-sonnet-20241022",
      "claude-3-7-sonnet-20250219",
    ],
  },
  openai: {
    createAi: createOpenAI,
    models: [
      "gpt-4.1-mini",
      "gpt-4o-mini",
      "o1",
      "o1-mini",
      "o3-mini", // Note: temperature can be overridden at the model level if needed
      "o4-mini",
    ],
  },
  google: {
    createAi: createGoogleGenerativeAI,
    models: [
      "gemini-2.0-flash-001",
      "gemini-2.0-flash-lite-preview-02-05",
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
      "gemini-2.5-pro-preview-05-06",
      "gemini-2.5-flash-preview-04-17",
      "gemini-2.0-pro-exp-02-05",
      "gemini-2.0-flash-thinking-exp-01-21",
    ],
  },
};

/**
 * Flattens the vendor-grouped configuration into a simple map for easy lookup.
 * This improves performance by avoiding repeated searches through nested arrays.
 */
const AI_SDK_MODELS_MAP = new Map<string, ModelConfig>(
  Object.values(AI_SDK_VENDORS).flatMap(vendor =>
    vendor.models.map(modelName => [
      modelName,
      { name: modelName, createAi: vendor.createAi },
    ])
  )
);

// Add models with specific overrides, like temperature
AI_SDK_MODELS_MAP.set("o3-mini", { ...AI_SDK_MODELS_MAP.get("o3-mini")!, temperature: 1 });
AI_SDK_MODELS_MAP.set("o4-mini", { ...AI_SDK_MODELS_MAP.get("o4-mini")!, temperature: 1 });


/**
 * Configuration for SAP AI SDK models.
 */
const SAP_AI_SDK_MODELS: ModelConfig[] = [
  { name: "anthropic--claude-3.7-sonnet" },
  { name: "anthropic--claude-3.5-sonnet" },
  { name: "anthropic--claude-3-sonnet" },
  { name: "anthropic--claude-3-haiku" },
  { name: "anthropic--claude-3-opus" },
  { name: "gpt-4o" },
  { name: "gpt-4" },
  { name: "gpt-4o-mini" },
  { name: "o1" },
  { name: "gpt-4.1" },
  { name: "gpt-4.1-nano" },
  { name: "o3-mini" },
  { name: "o3" },
  { name: "o4-mini" },
];

const SAP_AI_SDK_MODELS_MAP = new Map<string, ModelConfig>(
  SAP_AI_SDK_MODELS.map(m => [m.name, m])
);

/**
 * A map that holds all model configurations for all providers.
 */
const LLM_MODELS_MAP: Record<AIProviderType, Map<string, ModelConfig>> = {
  [AIProviderType.AI_SDK]: AI_SDK_MODELS_MAP,
  [AIProviderType.SAP_AI_SDK]: SAP_AI_SDK_MODELS_MAP,
};

// --- Provider Factory ---

/**
 * The AIProviderFactory is responsible for creating an instance of an AIProvider.
 * This simplifies the logic within the main execution function.
 */
class AIProviderFactory {
  static getProvider(providerType: AIProviderType, modelConfig: ModelConfig): AIProvider {
    switch (providerType) {
      case AIProviderType.AI_SDK:
        if (!modelConfig.createAi) {
          throw new Error(`Configuration error: No 'createAi' function found for model ${modelConfig.name}.`);
        }
        return new AISDKProvider(modelConfig.createAi, modelConfig.name);

      case AIProviderType.SAP_AI_SDK:
        return new SAPAIProvider(modelConfig.name);

      default:
        // This case should be unreachable if the input is validated beforehand.
        throw new Error(`Internal error: Unknown provider type '${providerType}'.`);
    }
  }
}

// --- Main Execution Function ---

/**
 * A helper function to validate the provider type from the configuration.
 * @param provider The provider string from config.
 * @returns A validated AIProviderType.
 * @throws An error if the provider is not a valid enum member.
 */
function getValidatedProviderType(provider: string): AIProviderType {
  const providerType = provider as AIProviderType;
  if (!Object.values(AIProviderType).includes(providerType)) {
    throw new Error(
      `Configuration Error: Unknown LLM provider '${provider}'. Valid providers are: ${Object.values(AIProviderType).join(", ")}`
    );
  }
  return providerType;
}

/**
 * Runs a prompt against the configured AI model and provider.
 * @param prompt The user's prompt.
 * @param systemPrompt An optional system-level instruction.
 * @param schema The Zod schema for the expected output structure.
 * @returns The result from the AI inference.
 */
export async function runPrompt({
  prompt,
  systemPrompt,
  schema,
}: {
  prompt: string;
  systemPrompt?: string;
  schema: z.ZodObject<any, any>;
}) {
  // 1. Get and validate the provider type from the global config
  const providerType = getValidatedProviderType(config.llmProvider);

  // 2. Find the model configuration for the selected provider
  const providerModelsMap = LLM_MODELS_MAP[providerType];
  const modelConfig = providerModelsMap.get(config.llmModel ?? "");

  if (!modelConfig) {
    const supportedModels = Array.from(providerModelsMap.keys()).join(", ");
    throw new Error(
      `Configuration Error: Unknown LLM model '${config.llmModel}' for provider '${providerType}'. Supported models are: ${supportedModels}`
    );
  }

  // 3. Get the appropriate provider instance for this model
  const provider = AIProviderFactory.getProvider(providerType, modelConfig);

  // 4. Run the inference
  try {
    return await provider.runInference({
      prompt,
      schema,
      system: systemPrompt,
      temperature: modelConfig.temperature, // Pass the default temperature from the config
    });
  } catch (error) {
    // Add more context to the error for easier debugging
    console.error(`Error during inference with model ${modelConfig.name} from provider ${providerType}:`, error);
    throw new Error(`Inference failed for model ${modelConfig.name}.`);
  }
}
