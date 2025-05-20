import axios from "axios";
import { AIProvider, InferenceConfig } from "@/ai";
import config from "../config";
import { info } from "@actions/core";
import { StructuredOutputParser } from "@langchain/core/output_parsers";

interface Deployment {
  id: string;
  name: string;
}
interface Token {
  access_token: string;
  expires_in: number;
  scope: string;
  jti: string;
  token_type: string;
  expires_at: number;
}
export class SAPAIProvider implements AIProvider {
  private modelName: string;
  private token?: Token;
  private deployments?: Deployment[];

  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private tokenUrl: string;
  private resourceGroup: string;

  constructor(modelName: string) {
    this.modelName = modelName;

    if (!config.sapAiCoreClientId) {
      throw new Error("SAP_AI_CORE_CLIENT_ID is not set");
    }
    if (!config.sapAiCoreClientSecret) {
      throw new Error("SAP_AI_CORE_CLIENT_SECRET is not set");
    }
    if (!config.sapAiCoreBaseUrl) {
      throw new Error("SAP_AI_CORE_BASE_URL is not set");
    }
    if (!config.sapAiCoreTokenUrl) {
      throw new Error("SAP_AI_CORE_TOKEN_URL is not set");
    }
    this.clientId = config.sapAiCoreClientId;
    this.clientSecret = config.sapAiCoreClientSecret;
    this.baseUrl = config.sapAiCoreBaseUrl;
    this.tokenUrl = config.sapAiCoreTokenUrl;
    this.resourceGroup = config.sapAiResourceGroup || "default";
  }

  // Authentication method
  private async authenticate(): Promise<Token> {
    const payload = {
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    };

    const response = await axios.post(this.tokenUrl, payload, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const token = response.data as Token;
    token.expires_at = Date.now() + token.expires_in * 1000;
    return token;
  }

  // Get token (with caching)
  private async getToken(): Promise<string> {
    if (!this.token || this.token.expires_at < Date.now()) {
      this.token = await this.authenticate();
    }
    return this.token.access_token;
  }

  // Get AI Core deployments
  private async getAiCoreDeployments(): Promise<Deployment[]> {
    const token = await this.getToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      "AI-Resource-Group": this.resourceGroup,
      "Content-Type": "application/json",
    };

    const url = `${this.baseUrl}/lm/deployments?$top=10000&$skip=0`;

    try {
      const response = await axios.get(url, { headers });
      const deployments = response.data.resources;

      return deployments
        .filter((deployment: any) => deployment.targetStatus === "RUNNING")
        .map((deployment: any) => {
          const model = deployment.details?.resources?.backend_details?.model;
          if (!model?.name || !model?.version) {
            return null; // Skip this row
          }
          return {
            id: deployment.id,
            name: `${model.name}:${model.version}`,
          };
        })
        .filter((deployment: any) => deployment !== null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching deployments: ${errorMessage}`);
      throw new Error(`Failed to fetch deployments: ${errorMessage}`);
    }
  }

  // Get deployment for a specific model
  private async getDeploymentForModel(modelId: string): Promise<string> {
    // If deployments are not fetched yet or the model is not found in the fetched deployments, fetch deployments
    if (!this.deployments || !this.hasDeploymentForModel(modelId)) {
      this.deployments = await this.getAiCoreDeployments();
    }

    const deployment = this.deployments.find((d) => {
      const deploymentBaseName = d.name.split(":")[0].toLowerCase();
      const modelBaseName = modelId.split(":")[0].toLowerCase();
      return deploymentBaseName === modelBaseName;
    });

    if (!deployment) {
      throw new Error(`No running deployment found for model ${modelId}`);
    }

    return deployment.id;
  }

  // Check if deployment exists for model
  private hasDeploymentForModel(modelId: string): boolean {
    return (
      this.deployments?.some(
        (d) =>
          d.name.split(":")[0].toLowerCase() ===
          modelId.split(":")[0].toLowerCase()
      ) ?? false
    );
  }

  // Helper methods to identify model types
  private isAnthropicModel(modelName: string): boolean {
    return modelName.includes("claude");
  }

  private isClaude37Model(modelName: string): boolean {
    return modelName.includes("claude-3.7");
  }

  private isOpenAIModel(modelName: string): boolean {
    return modelName.includes("gpt") || modelName.startsWith("o");
  }

  // Main inference method
  async runInference({
    prompt,
    temperature,
    system,
    schema,
  }: InferenceConfig): Promise<any> {
    // Get token and deployment
    const token = await this.getToken();
    const deploymentId = await this.getDeploymentForModel(this.modelName);

    // Prepare headers
    const headers = {
      Authorization: `Bearer ${token}`,
      "AI-Resource-Group": this.resourceGroup,
      "Content-Type": "application/json",
    };

    // Prepare system prompt to include target schema
    const parser = StructuredOutputParser.fromZodSchema(schema);
    system = system
      ? `${system}\n\n${parser.getFormatInstructions()}`
      : parser.getFormatInstructions();

    // Determine model type and prepare payload
    const isAnthropicModel = this.isAnthropicModel(this.modelName);
    const isOpenAIModel = this.isOpenAIModel(this.modelName);

    let url: string;
    let payload: any;

    if (isAnthropicModel) {
      if (this.isClaude37Model(this.modelName)) {
        // Use converse endpoint for Claude 3.7
        url = `${this.baseUrl}/inference/deployments/${deploymentId}/converse`;
        payload = {
          system: system ? [{ text: system }] : undefined,
          messages: [{ role: "user", content: [{ text: prompt }] }],
        };
      } else {
        // Use invoke endpoint for other Anthropic models
        url = `${this.baseUrl}/inference/deployments/${deploymentId}/invoke`;
        payload = {
          system: system || "",
          messages: [{ role: "user", content: prompt }],
        };
      }
    } else if (isOpenAIModel) {
      // Use non-streaming OpenAI/Azure API
      url = `${this.baseUrl}/inference/deployments/${deploymentId}/chat/completions?api-version=2024-12-01-preview`;
      payload = {
        messages: [
          { role: "system", content: system || "" },
          { role: "user", content: prompt },
        ],
        temperature: temperature || 0,
      };
    } else {
      throw new Error(`Unsupported model: ${this.modelName}`);
    }

    // Make API call
    const response = await axios.post(url, payload, { headers });

    // Process response based on model type
    let result;
    if (isAnthropicModel) {
      if (this.isClaude37Model(this.modelName)) {
        // Claude 3.7 response format is different
        result = response.data.output.message.content[0].text;
      } else {
        result = response.data.content[0].text;
      }
    } else if (isOpenAIModel) {
      result = response.data.choices[0].message.content;
    }

    // Log usage if in debug mode
    if (process.env.DEBUG) {
      let usage = {};
      if (this.isClaude37Model(this.modelName) && response.data.usage) {
        usage = {
          input_tokens: response.data.usage.inputTokens,
          output_tokens: response.data.usage.outputTokens,
        };
      } else if (isAnthropicModel && response.data.usage) {
        usage = {
          input_tokens: response.data.usage.input_tokens,
          output_tokens: response.data.usage.output_tokens,
        };
      } else if (isOpenAIModel && response.data.usage) {
        usage = {
          prompt_tokens: response.data.usage.prompt_tokens,
          completion_tokens: response.data.usage.completion_tokens,
        };
      }
      info(`usage: \n${JSON.stringify(usage, null, 2)}`);
    }

    // Parse and validate against schema
    try {
      // Parse the result as JSON
      const parsedResult = await parser.parse(result);
      // Validate against schema
      return schema.parse(parsedResult);
    } catch (error) {
      throw new Error(`Failed to parse or validate response: ${error}`);
    }
  }
}
