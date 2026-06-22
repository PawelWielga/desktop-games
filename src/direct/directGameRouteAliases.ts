const DIRECT_GAME_ROUTE_ALIASES: Readonly<Record<string, string>> = {
  cc: "countries-cities",
};

const DIRECT_GAME_ROUTE_SEGMENTS: Readonly<Record<string, string>> = Object.freeze(
  Object.entries(DIRECT_GAME_ROUTE_ALIASES).reduce<Record<string, string>>((segments, [segment, appId]) => {
    segments[appId] = segment;
    return segments;
  }, {})
);

export function resolveDirectGameRouteAppId(routeSegment: string): string {
  const normalizedSegment = routeSegment.trim().toLowerCase();
  return DIRECT_GAME_ROUTE_ALIASES[normalizedSegment] ?? routeSegment;
}

export function getDirectGameRouteSegment(appId: string): string {
  return DIRECT_GAME_ROUTE_SEGMENTS[appId] ?? appId;
}
