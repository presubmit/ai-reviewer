import { getInput, getMultilineInput } from "@actions/core";
import { AIProviderType } from "./ai";

export class Config {
  public llmApiKey: string | undefined;
  public llmModel: string | undefined;
  public llmProvider: string;
  public llmBaseUrl: string | undefined;
  public githubToken: string | undefined;
  public styleGuideRules: string | undefined;
  public githubApiUrl: string;
  public githubServerUrl: string;
  public customMode: string | undefined;
  public reviewScopes: string[] | undefined;
  public allowTitleUpdate: boolean = true;
  public maxCodeblockLines: number;
  public maxReviewChars: number;

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
    const isBedrockWithAwsCreds = this.llmModel?.includes('qwen.') ||
                                   this.llmModel?.includes('anthropic.') ||
                                   this.llmModel?.includes('meta.') ||
                                   this.llmModel?.includes('amazon.');
    const hasAwsCredentials = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

    // SAP AI SDK and AWS Bedrock (with IAM credentials) do not require an API key
    if (!this.llmApiKey && !isSapAiSdk && !(isBedrockWithAwsCreds && hasAwsCredentials)) {
      throw new Error("LLM_API_KEY is not set");
    }

    // Configurable base URL for OpenAI-compatible providers (e.g., OpenRouter)
    const baseUrlFromEnv = process.env.LLM_BASE_URL;
    const baseUrlFromInput = getInput("llm_base_url");
    this.llmBaseUrl = baseUrlFromEnv || baseUrlFromInput || undefined;

    // GitHub Enterprise Server support
    this.githubApiUrl =
      process.env.GITHUB_API_URL || getInput('github_api_url') || 'https://api.github.com';
    this.githubServerUrl =
      process.env.GITHUB_SERVER_URL || getInput('github_server_url') || 'https://github.com';

    // Custom review mode: 'on' | 'off' | 'auto' (default)
    this.customMode = (
      process.env.CUSTOM_MODE || getInput('custom_mode') || 'auto'
    ).toLowerCase();

    // Review scopes: comma-separated list; default to comprehensive review areas
    const scopesRaw = process.env.REVIEW_SCOPES || getInput('review_scopes') || 'security,performance,best-practices';
    this.reviewScopes = scopesRaw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => !!s);

    // Gate PR title updates (enabled by default to preserve existing behavior)
    const allowTitle = process.env.ALLOW_TITLE_UPDATE || getInput('allow_title_update') || 'true';
    this.allowTitleUpdate = String(allowTitle).toLowerCase() === 'true';

    const maxCodeblockLinesEnv = process.env.REVIEW_MAX_CODEBLOCK_LINES || getInput('max_codeblock_lines');
    const parsedMaxCode = maxCodeblockLinesEnv && parseInt(maxCodeblockLinesEnv, 10);
    this.maxCodeblockLines = Number.isFinite(parsedMaxCode as any) && (parsedMaxCode as any)! > 0 ? (parsedMaxCode as any) : 60;

    const maxReviewCharsEnv = process.env.REVIEW_MAX_REVIEW_CHARS || getInput('max_review_chars');
    const parsedMaxReviewChars = maxReviewCharsEnv && parseInt(maxReviewCharsEnv, 10);
    this.maxReviewChars = Number.isFinite(parsedMaxReviewChars as any) && (parsedMaxReviewChars as any)! > 0 ? (parsedMaxReviewChars as any) : 725000;

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
      llmBaseUrl: undefined,
      styleGuideRules: "",
      sapAiCoreClientId: "mock-client-id",
      sapAiCoreClientSecret: "mock-client-secret",
      sapAiCoreTokenUrl: "mock-token-url",
      sapAiCoreBaseUrl: "mock-base-url",
      sapAiResourceGroup: "default",
      githubApiUrl: "https://api.github.com",
      githubServerUrl: "https://github.com",
      customMode: "off",
      reviewScopes: ["security", "performance", "best-practices"],
      allowTitleUpdate: true,
      maxCodeblockLines: 60,
      maxReviewChars: 725000,
      loadInputs: jest.fn(),
    }
  : configInstance!;
