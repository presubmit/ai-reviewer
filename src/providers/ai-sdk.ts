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
    const llm = this.createAiFunc({
      apiKey: config.llmApiKey,
      ...(config.llmBaseUrl && { baseURL: config.llmBaseUrl }),
    });
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
      throw error;
    }
  }
}
