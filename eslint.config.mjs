import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const files = ['src/**/*.ts'];

export default [
  { ignores: ['dist/**', 'src/generated/**'] },
  { ...js.configs.recommended, files },
  ...tsPlugin.configs['flat/recommended'].map(config => ({ ...config, files })),
  {
    files,
    languageOptions: { ecmaVersion: 2020, sourceType: 'module' },
    rules: {
      // Error.cause requires ES2022; the SDK targets ES2020.
      'preserve-caught-error': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
