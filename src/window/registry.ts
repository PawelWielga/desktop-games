// Compatibility shim for imports that omit the extension.
// The implementation lives in registry.tsx because it wraps lazy React apps.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite can resolve this TSX module, while TypeScript may warn about the explicit extension.
export * from "./registry.tsx";
