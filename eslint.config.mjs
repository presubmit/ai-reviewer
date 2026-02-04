import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  // Ignore build output and deps (works even when super-linter passes full paths)
  {
    ignores: [
      'dist/**',
      '**/dist/**',
      '/github/workspace/dist/**',
      '/tmp/lint/dist/**',
      'node_modules/**',
      'coverage/**',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules (no type-checking)
  ...tseslint.configs.recommended,

  // Your project-specific tweaks
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
