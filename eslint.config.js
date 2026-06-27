// Flat ESLint config for Angular + TypeScript + templates (ESLint v9)
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";
import globals from "globals";

export default tseslint.config(
  // Ignore build outputs and vendor dirs
  {
    ignores: ["dist/**", "node_modules/**", "*.zip"],
  },

  // TypeScript sources (with type-aware rules)
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        // Enable type-aware rules by using the project service
        projectService: true,
      },
      globals: {
        ...globals.browser,
        browser: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-prototype-builtins": "off",
      "no-case-declarations": "off",
    },
  },

  // Angular templates
  {
    files: ["**/*.html"],
    extends: [...angular.configs.templateRecommended],
  },

  // Plain JavaScript (e.g. the content script and this config)
  {
    files: ["**/*.js"],
    extends: [eslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
        browser: "readonly",
      },
    },
  }
);
