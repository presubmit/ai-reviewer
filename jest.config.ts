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
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(@octokit)/)'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/__tests__/**', '!src/__mocks__/**'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
