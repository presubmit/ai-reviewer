import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import n from 'eslint-plugin-n';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
import jsoncParser from 'jsonc-eslint-parser';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import pluginVue from 'eslint-plugin-vue';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  globalIgnores([
    '!**/.*',
    '**/node_modules/.*',
    '**/dist/**',
    '/github/workspace/dist/**',
    '/tmp/lint/dist/**',
    '**/node_modules/**',
    '**/coverage/**',
  ]),

  {
    // Global Settings
    settings: {
      react: { version: 'detect' }, // Fixes the React version warning
    },
    extends: compat.extends('eslint:recommended'),
    plugins: { n, prettier },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
        ...globals.node,
      },
    },
    rules: {
      'prettier/prettier': 'error',
      'n/no-process-exit': 'off', // Common in CLI/Actions
    },
  },

  {
    files: ['**/*.json', '**/*.jsonc', '**/*.json5'],
    extends: compat.extends('plugin:jsonc/recommended-with-jsonc'),
    languageOptions: { parser: jsoncParser },
  },

  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.jsx'],
    extends: compat.extends('plugin:react/recommended'),
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true, modules: true } },
    },
  },

  {
    files: ['**/*.ts', '**/*.cts', '**/*.mts', '**/*.tsx'],
    extends: compat.extends(
      'plugin:@typescript-eslint/recommended',
      'plugin:n/recommended',
      'plugin:react/recommended',
      'prettier',
    ),
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // FIX: Disable module resolution checks because TS handles this
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
      'n/no-extraneous-import': 'off',

      // FIX: Relax strict types for Action development
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
    },
  },

  ...pluginVue.configs['flat/recommended'],
]);
