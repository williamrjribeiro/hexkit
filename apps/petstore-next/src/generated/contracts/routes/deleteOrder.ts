import {
  deleteOrderParsedParams,
  deleteOrderServerParsedParams,
} from "../schemas/deleteOrderParameters.ts";

export const deleteOrderRequestMap = {} as const;
export type deleteOrderRequestMap = typeof deleteOrderRequestMap;

export const deleteOrderResponseHeadersMap = {} as const;
export type deleteOrderResponseHeadersMap = typeof deleteOrderResponseHeadersMap;

export const deleteOrderResponseMap = {} as const;
export type deleteOrderResponseMap = typeof deleteOrderResponseMap;

export type deleteOrderRouteResponse =
  | { status: "204";   };

export const clientRoute = {
  path: "/store/order/{orderId}",
  method: "delete",
  operationId: "deleteOrder",
  requestMap: deleteOrderRequestMap,
  responseHeadersMap: deleteOrderResponseHeadersMap,
  responseMap: deleteOrderResponseMap,
  params: deleteOrderParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/store/order/{orderId}",
  method: "delete",
  operationId: "deleteOrder",
  requestMap: deleteOrderRequestMap,
  responseHeadersMap: deleteOrderResponseHeadersMap,
  responseMap: deleteOrderResponseMap,
  params: deleteOrderServerParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;