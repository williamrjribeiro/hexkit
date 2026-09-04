import { User } from "../schemas/User.ts";

export const createUserRequestMap = {
  "application/json": User,
} as const;
export type createUserRequestMap = typeof createUserRequestMap;

export const createUserResponseHeadersMap = {} as const;
export type createUserResponseHeadersMap = typeof createUserResponseHeadersMap;

export const createUserResponseMap = {
  "201": {
    "application/json": User,
  },
} as const;
export type createUserResponseMap = typeof createUserResponseMap;

export type createUserRouteResponse =
  | { status: "201"; contentType: "application/json"; data: User; };

export const clientRoute = {
  path: "/user",
  method: "post",
  operationId: "createUser",
  requestMap: createUserRequestMap,
  responseHeadersMap: createUserResponseHeadersMap,
  responseMap: createUserResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/user",
  method: "post",
  operationId: "createUser",
  requestMap: createUserRequestMap,
  responseHeadersMap: createUserResponseHeadersMap,
  responseMap: createUserResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;