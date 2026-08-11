import { Order } from "../schemas/Order.ts";

export const placeOrderRequestMap = {
  "application/json": Order,
} as const;
export type placeOrderRequestMap = typeof placeOrderRequestMap;

export const placeOrderResponseHeadersMap = {} as const;
export type placeOrderResponseHeadersMap = typeof placeOrderResponseHeadersMap;

export const placeOrderResponseMap = {
  "201": {
    "application/json": Order,
  },
} as const;
export type placeOrderResponseMap = typeof placeOrderResponseMap;

export type placeOrderRouteResponse = {
  status: "201";
  contentType: "application/json";
  data: Order;
};

export const clientRoute = {
  path: "/store/order",
  method: "post",
  operationId: "placeOrder",
  requestMap: placeOrderRequestMap,
  responseHeadersMap: placeOrderResponseHeadersMap,
  responseMap: placeOrderResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/store/order",
  method: "post",
  operationId: "placeOrder",
  requestMap: placeOrderRequestMap,
  responseHeadersMap: placeOrderResponseHeadersMap,
  responseMap: placeOrderResponseMap,
  params: undefined,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;
