// Mock the entire @octokit modules
jest.mock('@octokit/action', () => {
  const MockOctokit = jest.fn().mockImplementation(() => ({
    rest: {
      repos: {},
      pulls: {},
      issues: {}
    }
  }));
  // Add the static plugin method
  const mockPlugin = jest.fn().mockReturnValue(MockOctokit);
  Object.defineProperty(MockOctokit, 'plugin', {
    value: mockPlugin
  });

  return {
    Octokit: MockOctokit
  };
});

jest.mock('@octokit/plugin-retry', () => ({
  retry: jest.fn()
}));

jest.mock('@octokit/plugin-throttling', () => ({
  throttling: jest.fn()
}));

import { initOctokit } from '../octokit';

describe('Octokit', () => {
  test('initializes with a token', () => {
    const octokit = initOctokit('test-token');
    expect(octokit).toBeDefined();
  });

  test('throws when no token is provided', () => {
    expect(() => initOctokit()).toThrow('GitHub token is required but was not provided');
  });

  test('initializes with a token and baseUrl', () => {
    const octokit = initOctokit('test-token', 'https://github.example.com/api/v3');
    expect(octokit).toBeDefined();
  });
});
