const DIRECT_GAME_ROUTE_ALIASES: Readonly<Record<string, string>> = {
  cc: "countries-cities",
};

export function resolveDirectGameRouteAppId(routeSegment: string): string {
  const normalizedSegment = routeSegment.trim().toLowerCase();
  return DIRECT_GAME_ROUTE_ALIASES[normalizedSegment] ?? routeSegment;
}
