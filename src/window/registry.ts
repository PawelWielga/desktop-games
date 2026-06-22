// Compatibility shim for imports that omit the extension.
// The implementation lives in registry.tsx because it wraps lazy React apps.
// @ts-ignore - TypeScript projects normally avoid TSX extensions, but Vite can resolve this module.
export * from "./registry.tsx";
