import { runPrompt, AIProviderType, resolveOpenRouterModel, OPENROUTER_MODEL_MAP } from '../ai';
import config from '../config';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';

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

describe('resolveOpenRouterModel', () => {
  test('preserves models that already include a provider prefix', () => {
    expect(resolveOpenRouterModel('anthropic/claude-sonnet-4.5')).toBe('anthropic/claude-sonnet-4.5');
    expect(resolveOpenRouterModel('openai/gpt-4o-mini')).toBe('openai/gpt-4o-mini');
    expect(resolveOpenRouterModel('google/gemini-2.5-flash')).toBe('google/gemini-2.5-flash');
    expect(resolveOpenRouterModel('meta-llama/llama-3.3-70b-instruct')).toBe('meta-llama/llama-3.3-70b-instruct');
  });

  test('maps known Claude models to their OpenRouter counterparts', () => {
    expect(resolveOpenRouterModel('claude-sonnet-4-5')).toBe('anthropic/claude-sonnet-4.5');
    expect(resolveOpenRouterModel('claude-sonnet-5')).toBe('anthropic/claude-sonnet-5');
    expect(resolveOpenRouterModel('claude-3-7-sonnet-20250219')).toBe('anthropic/claude-3.7-sonnet');
    expect(resolveOpenRouterModel('claude-3-5-sonnet-20241022')).toBe('anthropic/claude-3.5-sonnet');
  });

  test('dynamically prefixes unprefixed models', () => {
    expect(resolveOpenRouterModel('claude-opus-6-1')).toBe('anthropic/claude-opus-6.1');
    expect(resolveOpenRouterModel('gpt-5.5')).toBe('openai/gpt-5.5');
    expect(resolveOpenRouterModel('o4-mini')).toBe('openai/o4-mini');
    expect(resolveOpenRouterModel('gemini-3.0-flash')).toBe('google/gemini-3.0-flash');
  });
});

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

  test('auto-maps Claude model and passes compatibility and headers for OpenRouter', async () => {
    config.llmModel = 'claude-sonnet-4-5';
    config.llmBaseUrl = 'https://openrouter.ai/api/v1';

    await runPrompt({
      prompt: 'test prompt',
      schema: dummySchema,
    });

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseURL: 'https://openrouter.ai/api/v1',
      compatibility: 'compatible',
      headers: {
        'HTTP-Referer': 'https://presubmit.ai',
        'X-Title': 'Presubmit.ai',
      },
    });
    expect(createAnthropic).not.toHaveBeenCalled();
  });

  test('preserves already prefixed model for OpenRouter', async () => {
    config.llmModel = 'anthropic/claude-sonnet-4.5';
    config.llmBaseUrl = 'https://openrouter.ai/api/v1';

    await runPrompt({
      prompt: 'test prompt',
      schema: dummySchema,
    });

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseURL: 'https://openrouter.ai/api/v1',
      compatibility: 'compatible',
      headers: {
        'HTTP-Referer': 'https://presubmit.ai',
        'X-Title': 'Presubmit.ai',
      },
    });
  });

  test('routes to createAnthropic when base URL is an Anthropic gateway', async () => {
    config.llmModel = 'claude-sonnet-5';
    config.llmBaseUrl = 'https://gateway.ai.cloudflare.com/v1/account/gateway/anthropic';

    await runPrompt({
      prompt: 'test prompt',
      schema: dummySchema,
    });

    expect(createAnthropic).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseURL: 'https://gateway.ai.cloudflare.com/v1/account/gateway/anthropic',
    });
    expect(createOpenAI).not.toHaveBeenCalled();
  });

  test('routes to createGoogleGenerativeAI when base URL is a Google gateway', async () => {
    config.llmModel = 'gemini-2.5-flash';
    config.llmBaseUrl = 'https://gateway.ai.cloudflare.com/v1/account/gateway/google-ai-studio';

    await runPrompt({
      prompt: 'test prompt',
      schema: dummySchema,
    });

    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseURL: 'https://gateway.ai.cloudflare.com/v1/account/gateway/google-ai-studio',
    });
    expect(createOpenAI).not.toHaveBeenCalled();
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

  describe('Error diagnostics', () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    test('logs helpful diagnostic on OpenRouter 401', async () => {
      config.llmModel = 'claude-sonnet-4-5';
      config.llmBaseUrl = 'https://openrouter.ai/api/v1';

      (generateObject as jest.Mock).mockRejectedValueOnce({ statusCode: 401 });

      await expect(
        runPrompt({ prompt: 'test', schema: dummySchema })
      ).rejects.toBeDefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Authentication failed for OpenRouter (HTTP 401)')
      );
    });

    test('logs helpful diagnostic on OpenRouter 402 (insufficient credits)', async () => {
      config.llmModel = 'claude-sonnet-4-5';
      config.llmBaseUrl = 'https://openrouter.ai/api/v1';

      (generateObject as jest.Mock).mockRejectedValueOnce({ statusCode: 402 });

      await expect(
        runPrompt({ prompt: 'test', schema: dummySchema })
      ).rejects.toBeDefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payment required / insufficient credits (HTTP 402)')
      );
    });

    test('logs helpful diagnostic on 404 (model not found)', async () => {
      config.llmModel = 'nonexistent-model';
      config.llmBaseUrl = 'https://openrouter.ai/api/v1';

      (generateObject as jest.Mock).mockRejectedValueOnce({ statusCode: 404 });

      await expect(
        runPrompt({ prompt: 'test', schema: dummySchema })
      ).rejects.toBeDefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found on OpenRouter (HTTP 404)")
      );
    });

    test('logs helpful diagnostic on 429 (rate limit exceeded)', async () => {
      config.llmModel = 'claude-sonnet-4-5';
      config.llmBaseUrl = 'https://openrouter.ai/api/v1';

      (generateObject as jest.Mock).mockRejectedValueOnce({ statusCode: 429 });

      await expect(
        runPrompt({ prompt: 'test', schema: dummySchema })
      ).rejects.toBeDefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded (HTTP 429)')
      );
    });
  });
});
