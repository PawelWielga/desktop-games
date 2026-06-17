import js from "@eslint/js";
import prettier from "eslint-config-prettier";

const browserGlobals = {
  Blob: "readonly",
  CanvasRenderingContext2D: "readonly",
  Document: "readonly",
  Element: "readonly",
  Event: "readonly",
  HTMLCanvasElement: "readonly",
  HTMLElement: "readonly",
  KeyboardEvent: "readonly",
  MouseEvent: "readonly",
  ResizeObserver: "readonly",
  URL: "readonly",
  console: "readonly",
  document: "readonly",
  localStorage: "readonly",
  requestAnimationFrame: "readonly",
  window: "readonly",
};

export default [
  {
    ignores: ["dist/**", "build/**", "coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
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
  },
  prettier,
];
