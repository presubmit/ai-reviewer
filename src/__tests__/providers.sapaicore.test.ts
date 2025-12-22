import { jest } from '@jest/globals';
import { z } from 'zod';

describe('SAPAIProvider', () => {
  const mockPost = jest.fn();
  const mockGet = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.DEBUG;
    mockPost.mockReset();
    mockGet.mockReset();
  });

  function mockConfig() {
    jest.doMock('../config', () => ({
      __esModule: true,
      default: {
        sapAiCoreClientId: 'cid',
        sapAiCoreClientSecret: 'csecret',
        sapAiCoreBaseUrl: 'https://sap.example',
        sapAiCoreTokenUrl: 'https://sap.example/oauth/token',
        sapAiResourceGroup: 'rg',
      },
    }));
  }

  function mockAxios({ token = 'tok' }: { token?: string } = {}) {
    jest.doMock('axios', () => ({
      __esModule: true,
      default: {
        post: mockPost.mockImplementation((url: string) => {
          if (url.endsWith('/oauth/token')) {
            return Promise.resolve({ data: { access_token: token, expires_in: 3600, scope: '', jti: '', token_type: 'Bearer' } });
          }
          // inference calls in tests will override return via mockImplementationOnce
          return Promise.resolve({ data: {} });
        }),
        get: mockGet.mockImplementation(() => Promise.resolve({ data: { resources: [] } })),
      },
    }));
  }

  test('constructor throws when required config missing', async () => {
    jest.doMock('../config', () => ({ __esModule: true, default: {} }));
    const { SAPAIProvider } = await import('../providers/sapaicore');
    expect(() => new SAPAIProvider('gpt-4o')).toThrow('SAP_AI_CORE_CLIENT_ID is not set');
  });

  test('runs inference for Claude 3.7 (converse endpoint) and parses JSON', async () => {
    mockConfig();
    mockAxios();
    const { SAPAIProvider } = await import('../providers/sapaicore');

    // deployments
    const deployments = [{
      id: 'dep1',
      details: { resources: { backend_details: { model: { name: 'claude-3.7', version: 'latest' } } } },
      targetStatus: 'RUNNING',
    }];
    mockGet.mockResolvedValueOnce({ data: { resources: deployments } });

    // inference response for claude 3.7 converse path
    mockPost.mockImplementation((url: string) => {
      if (url.endsWith('/oauth/token')) {
        return Promise.resolve({ data: { access_token: 'tok', expires_in: 3600, token_type: 'Bearer' } });
      }
      if (url.includes('/converse')) {
        return Promise.resolve({ data: { output: { message: { content: [{ text: '{"foo":"bar"}' }] } }, usage: { inputTokens: 10, outputTokens: 5 } } });
      }
      return Promise.resolve({ data: {} });
    });

    const provider = new SAPAIProvider('claude-3.7');
    const schema = z.object({ foo: z.string() });
    const result = await provider.runInference({ prompt: 'p', temperature: 0, system: 's', schema });

    expect(result).toEqual({ foo: 'bar' });
    expect(mockGet).toHaveBeenCalledWith('https://sap.example/lm/deployments?$top=10000&$skip=0', expect.any(Object));
  });

  test('runs inference for OpenAI path and parses JSON', async () => {
    mockConfig();
    mockAxios();
    const { SAPAIProvider } = await import('../providers/sapaicore');

    const deployments = [{ id: 'dep2', details: { resources: { backend_details: { model: { name: 'gpt-4o-mini', version: '2024' } } } }, targetStatus: 'RUNNING' }];
    mockGet.mockResolvedValueOnce({ data: { resources: deployments } });

    mockPost.mockImplementation((url: string) => {
      if (url.endsWith('/oauth/token')) {
        return Promise.resolve({ data: { access_token: 'tok', expires_in: 3600, token_type: 'Bearer' } });
      }
      if (url.includes('/chat/completions')) {
        return Promise.resolve({ data: { choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } } });
      }
      return Promise.resolve({ data: {} });
    });

    const provider = new SAPAIProvider('gpt-4o-mini');
    const schema = z.object({ a: z.number() });
    const result = await provider.runInference({ prompt: 'p', temperature: 0.1, system: undefined, schema });
    expect(result).toEqual({ a: 1 });
  });

  test('throws for unsupported model', async () => {
    mockConfig();
    mockAxios();
    const { SAPAIProvider } = await import('../providers/sapaicore');

    const deployments = [{ id: 'dep3', details: { resources: { backend_details: { model: { name: 'mistral-7b', version: '1' } } } }, targetStatus: 'RUNNING' }];
    mockGet.mockResolvedValueOnce({ data: { resources: deployments } });

    const provider = new SAPAIProvider('mistral-7b');
    const schema = z.object({ ok: z.boolean() });
    await expect(provider.runInference({ prompt: 'p', temperature: 0, system: '', schema })).rejects.toThrow('Unsupported model: mistral-7b');
  });


  test('DEBUG logs usage for Anthropic non-3.7 path', async () => {
    mockConfig();
    mockAxios();
    jest.doMock('@actions/core', () => ({ __esModule: true, info: jest.fn() }));
    process.env.DEBUG = '1';

    const { SAPAIProvider } = await import('../providers/sapaicore');

    const deployments = [{ id: 'dep4', details: { resources: { backend_details: { model: { name: 'claude-3.5', version: 'latest' } } } }, targetStatus: 'RUNNING' }];
    mockGet.mockResolvedValueOnce({ data: { resources: deployments } });

    mockPost.mockImplementation((url: string) => {
      if (url.endsWith('/oauth/token')) {
        return Promise.resolve({ data: { access_token: 'tok', expires_in: 3600, token_type: 'Bearer' } });
      }
      if (url.includes('/invoke')) {
        return Promise.resolve({ data: { content: [{ text: '{"x":true}' }], usage: { input_tokens: 2, output_tokens: 1 } } });
      }
      return Promise.resolve({ data: {} });
    });

    const provider = new SAPAIProvider('claude-3.5');
    const schema = z.object({ x: z.boolean() });
    const out = await provider.runInference({ prompt: 'p', temperature: 0, system: '', schema });
    expect(out).toEqual({ x: true });
  });



  test('throws when no running deployment found for model', async () => {
    mockConfig();
    mockAxios();
    const { SAPAIProvider } = await import('../providers/sapaicore');

    // Return deployments that do not match requested model base
    const deployments = [{ id: 'depX', details: { resources: { backend_details: { model: { name: 'gpt-4o', version: 'mini' } } } }, targetStatus: 'RUNNING' }];
    mockGet.mockResolvedValueOnce({ data: { resources: deployments } });
    mockPost.mockImplementation((url: string) => {
      if (url.endsWith('/oauth/token')) {
        return Promise.resolve({ data: { access_token: 'tok', expires_in: 3600, token_type: 'Bearer' } });
      }
      return Promise.resolve({ data: {} });
    });

    const provider = new SAPAIProvider('claude-3.5');
    const schema = z.object({ ok: z.boolean().optional() });
    await expect(provider.runInference({ prompt: 'p', temperature: 0, system: '', schema })).rejects.toThrow(/No running deployment found/);
  });


});
