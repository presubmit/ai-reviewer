import { runPrompt, AIProviderType } from '../ai';
import config from '../config';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Mock config
jest.mock('../config', () => ({
  __esModule: true,
  default: {
    llmProvider: 'ai-sdk',
    llmModel: 'claude-sonnet-5',
    llmApiKey: 'test-api-key',
    llmBaseUrl: undefined,
  },
}));

describe('runPrompt and model resolution', () => {
  const dummySchema = z.object({ response: z.string() });

  beforeEach(() => {
    jest.clearAllMocks();
    config.llmProvider = AIProviderType.AI_SDK;
    config.llmBaseUrl = undefined;
  });

  test('routes standard Claude model to createAnthropic when no base URL', async () => {
    config.llmModel = 'claude-sonnet-5';
    config.llmBaseUrl = undefined;

    await runPrompt({
      prompt: 'test prompt',
      schema: dummySchema,
    });

    expect(createAnthropic).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
    });
    expect(createOpenAI).not.toHaveBeenCalled();
  });

  test('routes standard OpenAI model to createOpenAI when no base URL', async () => {
    config.llmModel = 'gpt-5';
    config.llmBaseUrl = undefined;

    await runPrompt({
      prompt: 'test prompt',
      schema: dummySchema,
    });

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
    });
    expect(createAnthropic).not.toHaveBeenCalled();
  });

  test('routes standard Gemini model to createGoogleGenerativeAI when no base URL', async () => {
    config.llmModel = 'gemini-2.5-flash';
    config.llmBaseUrl = undefined;

    await runPrompt({
      prompt: 'test prompt',
      schema: dummySchema,
    });

    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
    });
  });

  test('routes Claude model to createOpenAI when LLM_BASE_URL is set (e.g. OpenRouter)', async () => {
    config.llmModel = 'claude-sonnet-5';
    config.llmBaseUrl = 'https://openrouter.ai/api/v1';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runPrompt({
      prompt: 'test prompt',
      schema: dummySchema,
    });

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseURL: 'https://openrouter.ai/api/v1',
    });
    expect(createAnthropic).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[warning] OpenRouter model names typically require a provider prefix')
    );

    warnSpy.mockRestore();
  });

  test('does not warn for OpenRouter when model name includes provider prefix', async () => {
    config.llmModel = 'anthropic/claude-sonnet-4.5';
    config.llmBaseUrl = 'https://openrouter.ai/api/v1';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runPrompt({
      prompt: 'test prompt',
      schema: dummySchema,
    });

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseURL: 'https://openrouter.ai/api/v1',
    });
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('throws error for unknown model when no base URL is configured', async () => {
    config.llmModel = 'unknown-model-xyz';
    config.llmBaseUrl = undefined;

    await expect(
      runPrompt({
        prompt: 'test prompt',
        schema: dummySchema,
      })
    ).rejects.toThrow(/Unknown LLM model: unknown-model-xyz/);
  });
});
