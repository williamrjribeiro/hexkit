import { Pet } from "../schemas/Pet.ts";

import {
  updatePetWithFormParsedParams,
  updatePetWithFormServerParsedParams,
} from "../schemas/updatePetWithFormParameters.ts";

export const updatePetWithFormRequestMap = {} as const;
export type updatePetWithFormRequestMap = typeof updatePetWithFormRequestMap;

export const updatePetWithFormResponseHeadersMap = {} as const;
export type updatePetWithFormResponseHeadersMap = typeof updatePetWithFormResponseHeadersMap;

export const updatePetWithFormResponseMap = {
  "200": {
    "application/json": Pet,
  },
} as const;
export type updatePetWithFormResponseMap = typeof updatePetWithFormResponseMap;

export type updatePetWithFormRouteResponse =
  | { status: "200"; contentType: "application/json"; data: Pet; }
  | { status: "400";   }
  | { status: "404";   };

export const clientRoute = {
  path: "/pet/{petId}",
  method: "post",
  operationId: "updatePetWithForm",
  requestMap: updatePetWithFormRequestMap,
  responseHeadersMap: updatePetWithFormResponseHeadersMap,
  responseMap: updatePetWithFormResponseMap,
  params: updatePetWithFormParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/pet/{petId}",
  method: "post",
  operationId: "updatePetWithForm",
  requestMap: updatePetWithFormRequestMap,
  responseHeadersMap: updatePetWithFormResponseHeadersMap,
  responseMap: updatePetWithFormResponseMap,
  params: updatePetWithFormServerParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;