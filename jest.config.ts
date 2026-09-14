import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@octokit/action$': '<rootDir>/src/__mocks__/@octokit/action.ts',
    '^@octokit/plugin-retry$': '<rootDir>/src/__mocks__/@octokit/plugin-retry.ts',
    '^@octokit/plugin-throttling$': '<rootDir>/src/__mocks__/@octokit/plugin-throttling.ts',
    '^@ai-sdk/anthropic$': '<rootDir>/src/__mocks__/@ai-sdk/anthropic.ts',
    '^@ai-sdk/google$': '<rootDir>/src/__mocks__/@ai-sdk/google.ts',
    '^@ai-sdk/openai$': '<rootDir>/src/__mocks__/@ai-sdk/openai.ts',
    '^ai$': '<rootDir>/src/__mocks__/ai.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@octokit|@ai-sdk/anthropic|@ai-sdk/google|@ai-sdk/openai|@ai-sdk/provider|@ai-sdk/provider-utils|@ai-sdk/ui-utils|ai)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/__mocks__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};

export default config; 