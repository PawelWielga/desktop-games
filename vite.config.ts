import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const srcPath = new URL("./src", import.meta.url).pathname;

declare const process: {
  env?: Record<string, string | undefined>;
};

const normalizeBasePath = (value?: string): string => {
  if (!value || value.trim().length === 0) {
    return "/";
  }

  const trimmed = value.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
};

const base = normalizeBasePath(process.env?.VITE_BASE_PATH);
const debugSourcemap = process.env?.VITE_DEBUG_SOURCEMAP === "true";

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    sourcemap: debugSourcemap ? "hidden" : false,
  },
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
});
