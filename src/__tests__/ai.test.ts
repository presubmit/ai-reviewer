import { z } from 'zod';

// We'll re-import runPrompt under different config mocks to hit branches

describe('ai.runPrompt', () => {
  const schema = z.object({ ok: z.boolean().default(true) });

  const isolate = async (configMock: any, providersMock?: any) => {
    jest.resetModules();
    jest.doMock('../config', () => ({ __esModule: true, default: configMock }));
    if (providersMock?.ai) {
      jest.doMock('../providers/ai-sdk', () => providersMock.ai);
    }
    if (providersMock?.sap) {
      jest.doMock('../providers/sapaicore', () => providersMock.sap);
    }
    const mod = await import('../ai');
    return mod;
  };

  test('throws on unknown provider', async () => {
    const { runPrompt } = await isolate({ llmProvider: 'nope', llmModel: 'gpt-4o-mini' });
    await expect(
      runPrompt({ prompt: 'p', systemPrompt: 's', schema: schema as any })
    ).rejects.toThrow(/Unknown LLM provider/i);
  });

  test('throws on unknown model for valid provider', async () => {
    const { runPrompt } = await isolate({ llmProvider: 'ai-sdk', llmModel: 'no-such-model' });
    await expect(
      runPrompt({ prompt: 'p', systemPrompt: 's', schema: schema as any })
    ).rejects.toThrow(/Unknown LLM model/i);
  });

  test('uses AI SDK provider and passes model temperature', async () => {
    const runInference = jest.fn().mockResolvedValue({ ok: 1 });
    const { runPrompt } = await isolate(
      { llmProvider: 'ai-sdk', llmModel: 'o3-mini' },
      {
        ai: {
          __esModule: true,
          AISDKProvider: class {
            constructor(public _create: any, public _name: string) {}
            runInference = runInference;
          }
        }
      }
    );
    const res = await runPrompt({ prompt: 'p', systemPrompt: 's', schema: schema as any });
    expect(res).toEqual({ ok: 1 });
    // o3-mini in ai.ts has temperature: 1
    expect(runInference).toHaveBeenCalledWith(expect.objectContaining({ temperature: 1 }));
  });

  test('uses SAP AI Core provider path', async () => {
    const runInference = jest.fn().mockResolvedValue({ ok: 2 });
    const { runPrompt } = await isolate(
      { llmProvider: 'sap-ai-sdk', llmModel: 'gpt-4o-mini' },
      {
        sap: {
          __esModule: true,
          SAPAIProvider: class {
            constructor(public _name: string) {}
            runInference = runInference;
          }
        }
      }
    );
    const res = await runPrompt({ prompt: 'p', systemPrompt: 's', schema: schema as any });
    expect(res).toEqual({ ok: 2 });
  });
});

