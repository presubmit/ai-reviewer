import { Config } from '../config';
import * as core from '@actions/core';

// Create manual mocks for core functions
const mockGetInput = jest.fn().mockImplementation(() => '');
const mockGetMultilineInput = jest.fn().mockImplementation(() => []);

// Mock the entire module
jest.mock('@actions/core', () => ({
  getInput: (...args: any[]) => mockGetInput(...args),
  getMultilineInput: (...args: any[]) => mockGetMultilineInput(...args),
  info: jest.fn(),
  warning: jest.fn()
}));

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockGetInput.mockImplementation(() => '');
    mockGetMultilineInput.mockImplementation(() => []);

    // Reset environment
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('throws error when GITHUB_TOKEN is not set', () => {
    process.env.GITHUB_TOKEN = '';
    process.env.LLM_API_KEY = 'test-api-key';
    process.env.LLM_MODEL = 'test-model';

    expect(() => new Config()).toThrow('GITHUB_TOKEN is not set');
  });

  test('throws error when LLM_API_KEY is not set', () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.LLM_API_KEY = '';
    process.env.LLM_MODEL = 'test-model';

    expect(() => new Config()).toThrow('LLM_API_KEY is not set');
  });

  test('throws error when LLM_MODEL is not set', () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.LLM_API_KEY = 'test-api-key';
    process.env.LLM_MODEL = '';

    expect(() => new Config()).toThrow('LLM_MODEL is not set');
  });

  test('loads style guide rules from action inputs', () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.LLM_API_KEY = 'test-api-key';
    process.env.LLM_MODEL = 'test-model';
    process.env.DEBUG = '';

    const styleGuideRules = ['Rule 1', 'Rule 2', 'Rule 3'];
    mockGetMultilineInput.mockImplementation((name) => {
      if (name === 'style_guide_rules') return styleGuideRules;
      return [];
    });

    const config = new Config();
    config.loadInputs();

    expect(config.styleGuideRules).toBe(styleGuideRules.join('\n'));
  });

  test('uses default GitHub URLs when not provided', () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.LLM_API_KEY = 'test-api-key';
    process.env.LLM_MODEL = 'test-model';

    const config = new Config();

    expect(config.githubApiUrl).toBe('https://api.github.com');
    expect(config.githubServerUrl).toBe('https://github.com');
  });

  test('loads GitHub Enterprise Server URLs from environment variables', () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.LLM_API_KEY = 'test-api-key';
    process.env.LLM_MODEL = 'test-model';
    process.env.GITHUB_API_URL = 'https://github.example.com/api/v3';
    process.env.GITHUB_SERVER_URL = 'https://github.example.com';

    const config = new Config();

    expect(config.githubApiUrl).toBe('https://github.example.com/api/v3');
    expect(config.githubServerUrl).toBe('https://github.example.com');
  });

  test('loads GitHub Enterprise Server URLs from action inputs', () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.LLM_API_KEY = 'test-api-key';
    process.env.LLM_MODEL = 'test-model';

    mockGetInput.mockImplementation((name) => {
      if (name === 'github_api_url') return 'https://github.example.com/api/v3';
      if (name === 'github_server_url') return 'https://github.example.com';
      return '';
    });

    const config = new Config();

    expect(config.githubApiUrl).toBe('https://github.example.com/api/v3');
    expect(config.githubServerUrl).toBe('https://github.example.com');
  });

  //   test('skips loading inputs when DEBUG is set', () => {
  //     process.env.GITHUB_TOKEN = 'test-token';
  //     process.env.LLM_API_KEY = 'test-api-key';
  //     process.env.LLM_MODEL = 'test-model';
  //     process.env.DEBUG = 'true';
  //     process.env.STYLE_GUIDE_RULES = 'Debug rule';

  //     const config = new Config();
  //     config.loadInputs();

  //     expect(config.styleGuideRules).toBe('Debug rule');
  //     expect(core.getMultilineInput).not.toHaveBeenCalled();
  //   });
});
