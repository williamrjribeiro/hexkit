import { LoginUser200Response } from "../schemas/LoginUser200Response.ts";

import {
  loginUserParsedParams,
  loginUserServerParsedParams,
} from "../schemas/loginUserParameters.ts";

export const loginUserRequestMap = {} as const;
export type loginUserRequestMap = typeof loginUserRequestMap;

import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

const loginUserResponseHeadersMap200Schema = z.object({ "x-expires-after": z.string().optional(), "x-rate-limit": z.coerce.number().int().optional() });

export const loginUserResponseHeadersMap = {
  "200": loginUserResponseHeadersMap200Schema,
} as const;
export type loginUserResponseHeadersMap = typeof loginUserResponseHeadersMap;

export const loginUserResponseMap = {
  "200": {
    "application/json": LoginUser200Response,
  },
} as const;
export type loginUserResponseMap = typeof loginUserResponseMap;

type loginUserRouteResponseHeadersForStatus<TStatus extends string> =
  TStatus extends keyof typeof loginUserResponseHeadersMap
    ? (typeof loginUserResponseHeadersMap)[TStatus] extends StandardSchemaV1
      ? StandardSchemaV1.InferOutput<(typeof loginUserResponseHeadersMap)[TStatus]>
      : undefined
    : undefined;

export type loginUserRouteResponse =
  | { status: "200"; contentType: "application/json"; data: LoginUser200Response; headers: loginUserRouteResponseHeadersForStatus<"200">; }
  | { status: "400";   headers: loginUserRouteResponseHeadersForStatus<"400">; };

export const clientRoute = {
  path: "/user/login",
  method: "get",
  operationId: "loginUser",
  requestMap: loginUserRequestMap,
  responseHeadersMap: loginUserResponseHeadersMap,
  responseMap: loginUserResponseMap,
  params: loginUserParsedParams,
  isQueryOptional: false,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/user/login",
  method: "get",
  operationId: "loginUser",
  requestMap: loginUserRequestMap,
  responseHeadersMap: loginUserResponseHeadersMap,
  responseMap: loginUserResponseMap,
  params: loginUserServerParsedParams,
  isQueryOptional: false,
  isHeadersOptional: true,
} as const;