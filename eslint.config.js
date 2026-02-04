/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/', 'dist/**', 'node_modules/', 'coverage/'],
  rules: {
    // Optional but common in Actions repos
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
