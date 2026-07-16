import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'tests/**', 'e2e/**', 'scripts/**', 'prisma/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      '@next/next/no-async-client-component': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      'no-undef': 'off',
      'prefer-const': 'off',
    },
  },
];
