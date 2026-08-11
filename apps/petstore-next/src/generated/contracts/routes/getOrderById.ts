import { Order } from "../schemas/Order.ts";

import {
  getOrderByIdParsedParams,
  getOrderByIdServerParsedParams,
} from "../schemas/getOrderByIdParameters.ts";

export const getOrderByIdRequestMap = {} as const;
export type getOrderByIdRequestMap = typeof getOrderByIdRequestMap;

export const getOrderByIdResponseHeadersMap = {} as const;
export type getOrderByIdResponseHeadersMap = typeof getOrderByIdResponseHeadersMap;

export const getOrderByIdResponseMap = {
  "200": {
    "application/json": Order,
  },
} as const;
export type getOrderByIdResponseMap = typeof getOrderByIdResponseMap;

export type getOrderByIdRouteResponse =
  | { status: "200"; contentType: "application/json"; data: Order }
  | { status: "404" };

export const clientRoute = {
  path: "/store/order/{orderId}",
  method: "get",
  operationId: "getOrderById",
  requestMap: getOrderByIdRequestMap,
  responseHeadersMap: getOrderByIdResponseHeadersMap,
  responseMap: getOrderByIdResponseMap,
  params: getOrderByIdParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/store/order/{orderId}",
  method: "get",
  operationId: "getOrderById",
  requestMap: getOrderByIdRequestMap,
  responseHeadersMap: getOrderByIdResponseHeadersMap,
  responseMap: getOrderByIdResponseMap,
  params: getOrderByIdServerParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;
