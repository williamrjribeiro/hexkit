import { FindPetsByStatus200Response } from "../schemas/FindPetsByStatus200Response.ts";

import {
  findPetsByStatusParsedParams,
  findPetsByStatusServerParsedParams,
} from "../schemas/findPetsByStatusParameters.ts";

export const findPetsByStatusRequestMap = {} as const;
export type findPetsByStatusRequestMap = typeof findPetsByStatusRequestMap;

export const findPetsByStatusResponseHeadersMap = {} as const;
export type findPetsByStatusResponseHeadersMap = typeof findPetsByStatusResponseHeadersMap;

export const findPetsByStatusResponseMap = {
  "200": {
    "application/json": FindPetsByStatus200Response,
  },
} as const;
export type findPetsByStatusResponseMap = typeof findPetsByStatusResponseMap;

export type findPetsByStatusRouteResponse =
  | { status: "200"; contentType: "application/json"; data: FindPetsByStatus200Response; }
  | { status: "400";   };

export const clientRoute = {
  path: "/pet/findByStatus",
  method: "get",
  operationId: "findPetsByStatus",
  requestMap: findPetsByStatusRequestMap,
  responseHeadersMap: findPetsByStatusResponseHeadersMap,
  responseMap: findPetsByStatusResponseMap,
  params: findPetsByStatusParsedParams,
  isQueryOptional: false,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/pet/findByStatus",
  method: "get",
  operationId: "findPetsByStatus",
  requestMap: findPetsByStatusRequestMap,
  responseHeadersMap: findPetsByStatusResponseHeadersMap,
  responseMap: findPetsByStatusResponseMap,
  params: findPetsByStatusServerParsedParams,
  isQueryOptional: false,
  isHeadersOptional: true,
} as const;