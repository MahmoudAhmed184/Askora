// @ts-check

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const reactRouterRouteExports = [
  "action",
  "clientAction",
  "clientLoader",
  "ErrorBoundary",
  "handle",
  "headers",
  "HydrateFallback",
  "links",
  "loader",
  "meta",
  "shouldRevalidate",
];

export default defineConfig(
  {
    name: "askora/ignores",
    ignores: [
      ".agents/**",
      ".codex/**",
      ".react-router/**",
      "build/**",
      "coverage/**",
      "design/**",
      "dist/**",
      "eslint.config.js",
      "node_modules/**",
      "playwright-report/**",
      "scripts/**/*.cjs",
      "scripts/**/*.d.mts",
      "scripts/**/*.mjs",
      "test-results/**",
    ],
  },
  {
    name: "askora/linter-options",
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  reactHooks.configs.flat["recommended-latest"],
  reactRefresh.configs.vite(),
  {
    name: "askora/typescript-react",
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "separate-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: false,
        },
      ],
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true,
          allowExportNames: reactRouterRouteExports,
        },
      ],
    },
  },
  eslintConfigPrettier,
);
