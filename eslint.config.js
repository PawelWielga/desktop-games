import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-config-prettier";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const browserGlobals = {
  AddEventListenerOptions: "readonly",
  Blob: "readonly",
  CanvasRenderingContext2D: "readonly",
  Document: "readonly",
  Element: "readonly",
  Event: "readonly",
  FileReader: "readonly",
  HTMLButtonElement: "readonly",
  HTMLCanvasElement: "readonly",
  HTMLDivElement: "readonly",
  HTMLElement: "readonly",
  Image: "readonly",
  KeyboardEvent: "readonly",
  MouseEvent: "readonly",
  Node: "readonly",
  PointerEvent: "readonly",
  ResizeObserver: "readonly",
  StorageEvent: "readonly",
  URL: "readonly",
  WebSocket: "readonly",
  alert: "readonly",
  cancelAnimationFrame: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  crypto: "readonly",
  document: "readonly",
  localStorage: "readonly",
  location: "readonly",
  requestAnimationFrame: "readonly",
  sessionStorage: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  window: "readonly",
};

export default [
  {
    ignores: [
      "build/**",
      "coverage/**",
      "dist/**",
      "legacy_backup/**",
      "node_modules/**",
      "playwright-report/**",
      "public/**",
      "storybook-static/**",
      "test-results/**",
      ".cache/**",
      ".tmp/**",
      ".vite/**",
      "temp/**",
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: browserGlobals,
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      "no-empty": "warn",
      "react/jsx-uses-react": "off",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
    },
  },
  prettier,
];
