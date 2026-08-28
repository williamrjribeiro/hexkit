import { FindPetsByTags200Response } from "../schemas/FindPetsByTags200Response.ts";

import {
  findPetsByTagsParsedParams,
  findPetsByTagsServerParsedParams,
} from "../schemas/findPetsByTagsParameters.ts";

export const findPetsByTagsRequestMap = {} as const;
export type findPetsByTagsRequestMap = typeof findPetsByTagsRequestMap;

export const findPetsByTagsResponseHeadersMap = {} as const;
export type findPetsByTagsResponseHeadersMap = typeof findPetsByTagsResponseHeadersMap;

export const findPetsByTagsResponseMap = {
  "200": {
    "application/json": FindPetsByTags200Response,
  },
} as const;
export type findPetsByTagsResponseMap = typeof findPetsByTagsResponseMap;

export type findPetsByTagsRouteResponse =
  | { status: "200"; contentType: "application/json"; data: FindPetsByTags200Response; }
  | { status: "400";   };

export const clientRoute = {
  path: "/pet/findByTags",
  method: "get",
  operationId: "findPetsByTags",
  requestMap: findPetsByTagsRequestMap,
  responseHeadersMap: findPetsByTagsResponseHeadersMap,
  responseMap: findPetsByTagsResponseMap,
  params: findPetsByTagsParsedParams,
  isQueryOptional: false,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/pet/findByTags",
  method: "get",
  operationId: "findPetsByTags",
  requestMap: findPetsByTagsRequestMap,
  responseHeadersMap: findPetsByTagsResponseHeadersMap,
  responseMap: findPetsByTagsResponseMap,
  params: findPetsByTagsServerParsedParams,
  isQueryOptional: false,
  isHeadersOptional: true,
} as const;