function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === "./") return "/";

  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function getRestoredGitHubPagesSpaPath(
  search: string,
  hash: string,
  basePath: string = import.meta.env.BASE_URL
): string | undefined {
  if (!search.startsWith("?/")) return undefined;

  const redirectValue = search.slice(2);
  const [pathPart = "", ...queryParts] = redirectValue.split("&");
  const normalizedPath = pathPart.replace(/^\/+/, "");
  const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  return `${normalizeBasePath(basePath)}${normalizedPath}${query}${hash}`;
}

export function restoreGitHubPagesSpaRoute(): void {
  if (typeof window === "undefined") return;

  const restoredPath = getRestoredGitHubPagesSpaPath(window.location.search, window.location.hash);
  if (!restoredPath) return;

  window.history.replaceState(null, "", restoredPath);
}
