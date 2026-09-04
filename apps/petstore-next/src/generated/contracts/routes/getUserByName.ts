import { User } from "../schemas/User.ts";

import {
  getUserByNameParsedParams,
  getUserByNameServerParsedParams,
} from "../schemas/getUserByNameParameters.ts";

export const getUserByNameRequestMap = {} as const;
export type getUserByNameRequestMap = typeof getUserByNameRequestMap;

export const getUserByNameResponseHeadersMap = {} as const;
export type getUserByNameResponseHeadersMap = typeof getUserByNameResponseHeadersMap;

export const getUserByNameResponseMap = {
  "200": {
    "application/json": User,
  },
} as const;
export type getUserByNameResponseMap = typeof getUserByNameResponseMap;

export type getUserByNameRouteResponse =
  | { status: "200"; contentType: "application/json"; data: User; }
  | { status: "404";   };

export const clientRoute = {
  path: "/user/{username}",
  method: "get",
  operationId: "getUserByName",
  requestMap: getUserByNameRequestMap,
  responseHeadersMap: getUserByNameResponseHeadersMap,
  responseMap: getUserByNameResponseMap,
  params: getUserByNameParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/user/{username}",
  method: "get",
  operationId: "getUserByName",
  requestMap: getUserByNameRequestMap,
  responseHeadersMap: getUserByNameResponseHeadersMap,
  responseMap: getUserByNameResponseMap,
  params: getUserByNameServerParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;