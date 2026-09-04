import { User } from "../schemas/User.ts";

import {
  updateUserParsedParams,
  updateUserServerParsedParams,
} from "../schemas/updateUserParameters.ts";

export const updateUserRequestMap = {
  "application/json": User,
} as const;
export type updateUserRequestMap = typeof updateUserRequestMap;

export const updateUserResponseHeadersMap = {} as const;
export type updateUserResponseHeadersMap = typeof updateUserResponseHeadersMap;

export const updateUserResponseMap = {
  "200": {
    "application/json": User,
  },
} as const;
export type updateUserResponseMap = typeof updateUserResponseMap;

export type updateUserRouteResponse =
  | { status: "200"; contentType: "application/json"; data: User; }
  | { status: "404";   };

export const clientRoute = {
  path: "/user/{username}",
  method: "put",
  operationId: "updateUser",
  requestMap: updateUserRequestMap,
  responseHeadersMap: updateUserResponseHeadersMap,
  responseMap: updateUserResponseMap,
  params: updateUserParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/user/{username}",
  method: "put",
  operationId: "updateUser",
  requestMap: updateUserRequestMap,
  responseHeadersMap: updateUserResponseHeadersMap,
  responseMap: updateUserResponseMap,
  params: updateUserServerParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;