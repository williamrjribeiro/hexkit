import { Pet } from "../schemas/Pet.ts";

export const addPetRequestMap = {
  "application/json": Pet,
} as const;
export type addPetRequestMap = typeof addPetRequestMap;

export const addPetResponseHeadersMap = {} as const;
export type addPetResponseHeadersMap = typeof addPetResponseHeadersMap;

export const addPetResponseMap = {
  "201": {
    "application/json": Pet,
  },
} as const;
export type addPetResponseMap = typeof addPetResponseMap;

export type addPetRouteResponse = { status: "201"; contentType: "application/json"; data: Pet };

export const clientRoute = {
  path: "/pet",
  method: "post",
  operationId: "addPet",
  requestMap: addPetRequestMap,
  responseHeadersMap: addPetResponseHeadersMap,
  responseMap: addPetResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/pet",
  method: "post",
  operationId: "addPet",
  requestMap: addPetRequestMap,
  responseHeadersMap: addPetResponseHeadersMap,
  responseMap: addPetResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;
