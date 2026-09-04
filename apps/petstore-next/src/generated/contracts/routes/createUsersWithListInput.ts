import { CreateUsersWithListInputRequest } from "../schemas/CreateUsersWithListInputRequest.ts";
import { User } from "../schemas/User.ts";

export const createUsersWithListInputRequestMap = {
  "application/json": CreateUsersWithListInputRequest,
} as const;
export type createUsersWithListInputRequestMap = typeof createUsersWithListInputRequestMap;

export const createUsersWithListInputResponseHeadersMap = {} as const;
export type createUsersWithListInputResponseHeadersMap = typeof createUsersWithListInputResponseHeadersMap;

export const createUsersWithListInputResponseMap = {
  "200": {
    "application/json": User,
  },
} as const;
export type createUsersWithListInputResponseMap = typeof createUsersWithListInputResponseMap;

export type createUsersWithListInputRouteResponse =
  | { status: "200"; contentType: "application/json"; data: User; };

export const clientRoute = {
  path: "/user/createWithList",
  method: "post",
  operationId: "createUsersWithListInput",
  requestMap: createUsersWithListInputRequestMap,
  responseHeadersMap: createUsersWithListInputResponseHeadersMap,
  responseMap: createUsersWithListInputResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/user/createWithList",
  method: "post",
  operationId: "createUsersWithListInput",
  requestMap: createUsersWithListInputRequestMap,
  responseHeadersMap: createUsersWithListInputResponseHeadersMap,
  responseMap: createUsersWithListInputResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;