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
  // 1. Global Ignores
  globalIgnores([
    '!**/.*',
    '**/node_modules/.*',
    '**/dist/**',
    '/github/workspace/dist/**',
    '/tmp/lint/dist/**',
    '**/node_modules/**',
    '**/coverage/**',
  ]),

  // 2. Base Configuration (JS Recommended + Plugins + Globals)
  {
    extends: compat.extends('eslint:recommended'),
    plugins: { n, prettier },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
        ...globals.node,
      },
    },
  },

  // 3. JSON / JSONC / JSON5 (Grouped for cleanliness)
  {
    files: ['**/*.json', '**/*.jsonc', '**/*.json5'],
    extends: compat.extends('plugin:jsonc/recommended-with-jsonc'),
    languageOptions: {
      parser: jsoncParser,
    },
  },

  // 4. JavaScript & React
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.jsx'],
    extends: compat.extends('plugin:react/recommended'),
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true, modules: true },
      },
    },
  },

  // 5. TypeScript (The core of a GitHub Action)
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
  },

  // 6. Vue (Native Flat Config)
  ...pluginVue.configs['flat/recommended'],
]);