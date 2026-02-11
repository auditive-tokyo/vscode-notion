import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "node_modules/",
      "dist/",
      ".git/",
      ".vscode/",
      "*.config.ts",
      "*.config.js",
      "webpack.config.ts",
      "api_responses/",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.{tsx,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ["**/notion-api-client.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["**/notion-api-utils/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["**/notion-tree-provider.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
