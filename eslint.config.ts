import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import jsonc from 'eslint-plugin-jsonc';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '.husky/**',
      'package-lock.json',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-console': ['error', { allow: ['error', 'warn'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.{1,2}/.*\\.(?:[cm]?[jt]s|[jt]sx)$',
              message: 'Use extensionless relative TypeScript imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    extends: [jsonc.configs['recommended-with-json']],
  },
  prettier,
  {
    files: ['**/*.ts'],
    // The "all" option is compatible with Prettier, which disables curly by default.
    rules: { curly: ['error', 'all'] },
  },
);
