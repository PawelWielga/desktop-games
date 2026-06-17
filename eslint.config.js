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
    ignores: ["build/**", "coverage/**", "dist/**", "legacy_backup/**", "node_modules/**", "public/**"],
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
