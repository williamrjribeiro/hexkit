export const logoutUserRequestMap = {} as const;
export type logoutUserRequestMap = typeof logoutUserRequestMap;

export const logoutUserResponseHeadersMap = {} as const;
export type logoutUserResponseHeadersMap = typeof logoutUserResponseHeadersMap;

export const logoutUserResponseMap = {} as const;
export type logoutUserResponseMap = typeof logoutUserResponseMap;

export type logoutUserRouteResponse =
  | { status: "200";   };

export const clientRoute = {
  path: "/user/logout",
  method: "get",
  operationId: "logoutUser",
  requestMap: logoutUserRequestMap,
  responseHeadersMap: logoutUserResponseHeadersMap,
  responseMap: logoutUserResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/user/logout",
  method: "get",
  operationId: "logoutUser",
  requestMap: logoutUserRequestMap,
  responseHeadersMap: logoutUserResponseHeadersMap,
  responseMap: logoutUserResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;