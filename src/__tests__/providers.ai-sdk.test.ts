import { AISDKProvider } from '../providers/ai-sdk';
import config from '../config';

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
}));

// Mock generateObject from 'ai'
const mockGenerateObject = jest.fn();
jest.mock('ai', () => ({
  generateObject: (...args: any[]) => (mockGenerateObject as any)(...args),
}));

describe('AISDKProvider', () => {
  const originalDebug = process.env.DEBUG;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.DEBUG;
  });

  afterAll(() => {
    process.env.DEBUG = originalDebug;
  });

  function makeCreateAiFunc(spy: { calls: any[] }) {
    // createAiFunc({ apiKey }) => llm(modelName) => modelRef
    return ({ apiKey }: { apiKey: string }) => {
      spy.calls.push({ apiKey });
      return (modelName: string) => ({ provider: 'ai-sdk', modelName });
    };
  }

  test('passes config API key to createAiFunc and calls generateObject with defaults', async () => {
    const calls: any[] = [];
    const createAiFunc = makeCreateAiFunc({ calls });

    // Arrange generateObject to return object + usage
    mockGenerateObject.mockResolvedValue({
      object: { ok: true, value: 42 },
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const provider = new AISDKProvider(createAiFunc as any, 'gpt-4o-mini');

    const result = await provider.runInference({
      prompt: 'Hello',
      temperature: undefined as any,
      system: 'sys',
      schema: { type: 'object' } as any,
    });

    // createAiFunc received API key from config
    expect(calls[0]).toEqual({ apiKey: (config as any).llmApiKey });

    // generateObject called with correct params
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    const args = mockGenerateObject.mock.calls[0][0];
    expect(args.prompt).toBe('Hello');
    expect(args.system).toBe('sys');
    expect(args.schema).toEqual({ type: 'object' });
    expect(args.temperature).toBe(1); // defaulted to 1
    expect(args.model).toEqual({ provider: 'ai-sdk', modelName: 'gpt-4o-mini' });

    // returns the parsed object
    expect(result).toEqual({ ok: true, value: 42 });
  });

  test('uses provided temperature and logs usage in DEBUG mode', async () => {
    process.env.DEBUG = '1';
    const { info } = require('@actions/core');

    const calls: any[] = [];
    const createAiFunc = makeCreateAiFunc({ calls });

    mockGenerateObject.mockResolvedValue({
      object: { ok: true },
      usage: { inputTokens: 1, outputTokens: 2 },
    });

    const provider = new AISDKProvider(createAiFunc as any, 'anthropic/claude-3-haiku');

    await provider.runInference({
      prompt: 'P',
      temperature: 0.7,
      system: 'S',
      schema: { type: 'object' } as any,
    });

    const args = mockGenerateObject.mock.calls[0][0];
    expect(args.temperature).toBe(0.7);

    // info called with usage JSON when DEBUG set
    expect(info).toHaveBeenCalled();
    const msg = (info as jest.Mock).mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(msg).toContain('usage:');
  });

  test('propagates errors from generateObject', async () => {
    const calls: any[] = [];
    const createAiFunc = makeCreateAiFunc({ calls });

    mockGenerateObject.mockRejectedValue(new Error('upstream failure'));

    const provider = new AISDKProvider(createAiFunc as any, 'google/gemini-1.5-pro');

    await expect(
      provider.runInference({
        prompt: 'X',
        temperature: undefined as any,
        system: '',
        schema: { type: 'object' } as any,
      })
    ).rejects.toThrow('upstream failure');
  });
});

