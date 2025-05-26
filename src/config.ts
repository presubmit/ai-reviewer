import { getInput, getMultilineInput } from "@actions/core";
import { AIProviderType } from "./ai";

export class Config {
  public llmApiKey: string | undefined;
  public llmModel: string | undefined;
  public llmProvider: string;
  public githubToken: string | undefined;
  public styleGuideRules: string | undefined;

  public sapAiCoreClientId: string | undefined;
  public sapAiCoreClientSecret: string | undefined;
  public sapAiCoreTokenUrl: string | undefined;
  public sapAiCoreBaseUrl: string | undefined;
  public sapAiResourceGroup: string | undefined;

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
    if (!this.githubToken) {
      throw new Error("GITHUB_TOKEN is not set");
    }

    this.llmModel = process.env.LLM_MODEL || getInput("llm_model");
    if (!this.llmModel?.length) {
      throw new Error("LLM_MODEL is not set");
    }

    this.llmProvider = process.env.LLM_PROVIDER || getInput("llm_provider");
    if (!this.llmProvider?.length) {
      this.llmProvider = AIProviderType.AI_SDK;
      console.log(`Using default LLM_PROVIDER '${this.llmProvider}'`);
    }

    this.llmApiKey = process.env.LLM_API_KEY;
    const isSapAiSdk = this.llmProvider === AIProviderType.SAP_AI_SDK;
    // SAP AI SDK does not require an API key
    if (!this.llmApiKey && !isSapAiSdk) {
      throw new Error("LLM_API_KEY is not set");
    }

    // SAP AI Core configuration
    this.sapAiCoreClientId = process.env.SAP_AI_CORE_CLIENT_ID;
    this.sapAiCoreClientSecret = process.env.SAP_AI_CORE_CLIENT_SECRET;
    this.sapAiCoreTokenUrl = process.env.SAP_AI_CORE_TOKEN_URL;
    this.sapAiCoreBaseUrl = process.env.SAP_AI_CORE_BASE_URL;
    this.sapAiResourceGroup = process.env.SAP_AI_RESOURCE_GROUP;
    if (
      isSapAiSdk &&
      (!this.sapAiCoreClientId ||
        !this.sapAiCoreClientSecret ||
        !this.sapAiCoreTokenUrl ||
        !this.sapAiCoreBaseUrl)
    ) {
      throw new Error(
        "SAP AI Core configuration is not set. Please set SAP_AI_CORE_CLIENT_ID, SAP_AI_CORE_CLIENT_SECRET, SAP_AI_CORE_TOKEN_URL, and SAP_AI_CORE_BASE_URL."
      );
    }

    if (!process.env.DEBUG) {
      return;
    }
    console.log("[debug] loading extra inputs from .env");

    this.styleGuideRules = process.env.STYLE_GUIDE_RULES;
  }

  public loadInputs() {
    if (process.env.DEBUG) {
      console.log("[debug] skip loading inputs");
      return;
    }

    // Custom style guide rules
    try {
      const styleGuideRules = getMultilineInput("style_guide_rules") || [];
      if (
        Array.isArray(styleGuideRules) &&
        styleGuideRules.length &&
        styleGuideRules[0].trim().length
      ) {
        this.styleGuideRules = styleGuideRules.join("\n");
      }
    } catch (e) {
      console.error("Error loading style guide rules:", e);
    }
  }
}

// For testing, we'll modify how the config instance is created
// This prevents the automatic loading when the module is imported
let configInstance: Config | null = null;

// If not in test environment, create and configure the instance
if (process.env.NODE_ENV !== "test") {
  configInstance = new Config();
  configInstance.loadInputs();
}

// Export the instance or a function to create one for tests
export default process.env.NODE_ENV === "test"
  ? {
      // Default values for tests
      githubToken: "mock-token",
      llmApiKey: "mock-api-key",
      llmModel: "mock-model",
      llmProvider: "mock-provider",
      styleGuideRules: "",
      sapAiCoreClientId: "mock-client-id",
      sapAiCoreClientSecret: "mock-client-secret",
      sapAiCoreTokenUrl: "mock-token-url",
      sapAiCoreBaseUrl: "mock-base-url",
      sapAiResourceGroup: "default",
      loadInputs: jest.fn(),
    }
  : configInstance!;
