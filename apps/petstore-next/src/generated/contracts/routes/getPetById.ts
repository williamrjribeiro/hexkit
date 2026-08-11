import { Pet } from "../schemas/Pet.ts";

import {
  getPetByIdParsedParams,
  getPetByIdServerParsedParams,
} from "../schemas/getPetByIdParameters.ts";

export const getPetByIdRequestMap = {} as const;
export type getPetByIdRequestMap = typeof getPetByIdRequestMap;

export const getPetByIdResponseHeadersMap = {} as const;
export type getPetByIdResponseHeadersMap = typeof getPetByIdResponseHeadersMap;

export const getPetByIdResponseMap = {
  "200": {
    "application/json": Pet,
  },
} as const;
export type getPetByIdResponseMap = typeof getPetByIdResponseMap;

export type getPetByIdRouteResponse =
  | { status: "200"; contentType: "application/json"; data: Pet; }
  | { status: "404";   };

export const clientRoute = {
  path: "/pet/{petId}",
  method: "get",
  operationId: "getPetById",
  requestMap: getPetByIdRequestMap,
  responseHeadersMap: getPetByIdResponseHeadersMap,
  responseMap: getPetByIdResponseMap,
  params: getPetByIdParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/pet/{petId}",
  method: "get",
  operationId: "getPetById",
  requestMap: getPetByIdRequestMap,
  responseHeadersMap: getPetByIdResponseHeadersMap,
  responseMap: getPetByIdResponseMap,
  params: getPetByIdServerParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;