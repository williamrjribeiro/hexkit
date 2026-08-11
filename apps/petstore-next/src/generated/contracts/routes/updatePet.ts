import { Pet } from "../schemas/Pet.ts";

export const updatePetRequestMap = {
  "application/json": Pet,
} as const;
export type updatePetRequestMap = typeof updatePetRequestMap;

export const updatePetResponseHeadersMap = {} as const;
export type updatePetResponseHeadersMap = typeof updatePetResponseHeadersMap;

export const updatePetResponseMap = {
  "200": {
    "application/json": Pet,
  },
} as const;
export type updatePetResponseMap = typeof updatePetResponseMap;

export type updatePetRouteResponse = { status: "200"; contentType: "application/json"; data: Pet };

export const clientRoute = {
  path: "/pet",
  method: "put",
  operationId: "updatePet",
  requestMap: updatePetRequestMap,
  responseHeadersMap: updatePetResponseHeadersMap,
  responseMap: updatePetResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/pet",
  method: "put",
  operationId: "updatePet",
  requestMap: updatePetRequestMap,
  responseHeadersMap: updatePetResponseHeadersMap,
  responseMap: updatePetResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;
