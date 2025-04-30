import config from "./config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { info } from "@actions/core";
import { z } from "zod";

const LLM_MODELS = [
  // Anthropic
  {
    name: "claude-3-5-sonnet-20240620",
    createAi: createAnthropic,
  },
  {
    name: "claude-3-5-sonnet-20241022",
    createAi: createAnthropic,
  },
  {
    name: "claude-3-7-sonnet-20250219",
    createAi: createAnthropic,
  },
  // OpenAI
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
  // Google stable models https://ai.google.dev/gemini-api/docs/models/gemini
  {
    name: "gemini-2.0-flash-001",
    createAi: createGoogleGenerativeAI,
  },
  {
    name: "gemini-2.0-flash-lite-preview-02-05",
    createAi: createGoogleGenerativeAI,
  },
  {
    name: "gemini-1.5-flash",
    createAi: createGoogleGenerativeAI,
  },
  {
    name: "gemini-1.5-flash-latest",
    createAi: createGoogleGenerativeAI,
  },
  {
    name: "gemini-1.5-flash-8b",
    createAi: createGoogleGenerativeAI,
  },
  {
    name: "gemini-1.5-pro",
    createAi: createGoogleGenerativeAI,
  },
  // Google experimental models https://ai.google.dev/gemini-api/docs/models/experimental-models
  {
    name: "gemini-2.0-pro-exp-02-05",
    createAi: createGoogleGenerativeAI,
  },
  {
    name: "gemini-2.0-flash-thinking-exp-01-21",
    createAi: createGoogleGenerativeAI,
  },
];

export async function runPrompt({
  prompt,
  systemPrompt,
  schema,
}: {
  prompt: string;
  systemPrompt?: string;
  schema: z.ZodObject<any, any>;
}) {
  const model = LLM_MODELS.find((m) => m.name === config.llmModel);
  if (!model) {
    throw new Error(`Unknown LLM model: ${config.llmModel}`);
  }

  const llm = model.createAi({ apiKey: config.llmApiKey });
  const { object, usage } = await generateObject({
    model: llm(model.name),
    prompt,
    system: systemPrompt,
    schema,
  });

  if (process.env.DEBUG) {
    info(`usage: \n${JSON.stringify(usage, null, 2)}`);
  }

  return object;
}
