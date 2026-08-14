import {
  deletePetParsedParams,
  deletePetServerParsedParams,
} from "../schemas/deletePetParameters.ts";

export const deletePetRequestMap = {} as const;
export type deletePetRequestMap = typeof deletePetRequestMap;

export const deletePetResponseHeadersMap = {} as const;
export type deletePetResponseHeadersMap = typeof deletePetResponseHeadersMap;

export const deletePetResponseMap = {} as const;
export type deletePetResponseMap = typeof deletePetResponseMap;

export type deletePetRouteResponse =
  | { status: "204";   };

export const clientRoute = {
  path: "/pet/{petId}",
  method: "delete",
  operationId: "deletePet",
  requestMap: deletePetRequestMap,
  responseHeadersMap: deletePetResponseHeadersMap,
  responseMap: deletePetResponseMap,
  params: deletePetParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/pet/{petId}",
  method: "delete",
  operationId: "deletePet",
  requestMap: deletePetRequestMap,
  responseHeadersMap: deletePetResponseHeadersMap,
  responseMap: deletePetResponseMap,
  params: deletePetServerParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;