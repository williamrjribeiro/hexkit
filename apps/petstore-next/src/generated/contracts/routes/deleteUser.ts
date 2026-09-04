import {
  deleteUserParsedParams,
  deleteUserServerParsedParams,
} from "../schemas/deleteUserParameters.ts";

export const deleteUserRequestMap = {} as const;
export type deleteUserRequestMap = typeof deleteUserRequestMap;

export const deleteUserResponseHeadersMap = {} as const;
export type deleteUserResponseHeadersMap = typeof deleteUserResponseHeadersMap;

export const deleteUserResponseMap = {} as const;
export type deleteUserResponseMap = typeof deleteUserResponseMap;

export type deleteUserRouteResponse =
  | { status: "204";   }
  | { status: "404";   };

export const clientRoute = {
  path: "/user/{username}",
  method: "delete",
  operationId: "deleteUser",
  requestMap: deleteUserRequestMap,
  responseHeadersMap: deleteUserResponseHeadersMap,
  responseMap: deleteUserResponseMap,
  params: deleteUserParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/user/{username}",
  method: "delete",
  operationId: "deleteUser",
  requestMap: deleteUserRequestMap,
  responseHeadersMap: deleteUserResponseHeadersMap,
  responseMap: deleteUserResponseMap,
  params: deleteUserServerParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;