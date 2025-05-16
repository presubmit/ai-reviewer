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
    const llm = this.createAiFunc({ apiKey: config.llmApiKey });
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
  }
}
