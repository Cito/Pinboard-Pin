// Flat ESLint config for Angular + TypeScript + templates (ESLint v9)
import pluginJs from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import angularTemplateParser from '@angular-eslint/template-parser';
import globals from 'globals';

export default [
  // Ignore build outputs and vendor dirs
  { ignores: ['dist/**', 'node_modules/**', '*.zip'] },

  pluginJs.configs.recommended,

  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Enable type-aware rules by using the project service
        projectService: true
      },
      globals: {
        ...globals.browser,
        browser: 'readonly'
      }
    },
    plugins: {
      '@angular-eslint': angular,
      '@typescript-eslint': tsPlugin
    },
    rules: {
      // Type-aware TS recommendations
      ...tsPlugin.configs['recommended-type-checked'].rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-prototype-builtins': 'off',
      'no-case-declarations': 'off'
    }
  },

  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        browser: 'readonly'
      }
    }
  },

  {
    files: ['**/*.html'],
    languageOptions: {
      parser: angularTemplateParser
    },
    plugins: {
      '@angular-eslint/template': angularTemplate
    },
    rules: {
      ...angularTemplate.configs.recommended.rules
    }
  }
];
