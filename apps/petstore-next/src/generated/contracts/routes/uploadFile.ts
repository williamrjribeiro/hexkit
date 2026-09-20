import { UploadFileRequest } from "../schemas/UploadFileRequest.ts";
import { ApiResponseSchema } from "../schemas/ApiResponseSchema.ts";

import {
  uploadFileParsedParams,
  uploadFileServerParsedParams,
} from "../schemas/uploadFileParameters.ts";

export const uploadFileRequestMap = {
  "application/octet-stream": UploadFileRequest,
} as const;
export type uploadFileRequestMap = typeof uploadFileRequestMap;

export const uploadFileResponseHeadersMap = {} as const;
export type uploadFileResponseHeadersMap = typeof uploadFileResponseHeadersMap;

export const uploadFileResponseMap = {
  "200": {
    "application/json": ApiResponseSchema,
  },
} as const;
export type uploadFileResponseMap = typeof uploadFileResponseMap;

export type uploadFileRouteResponse =
  | { status: "200"; contentType: "application/json"; data: ApiResponseSchema; }
  | { status: "400";   }
  | { status: "404";   };

export const clientRoute = {
  path: "/pet/{petId}/uploadImage",
  method: "post",
  operationId: "uploadFile",
  requestMap: uploadFileRequestMap,
  responseHeadersMap: uploadFileResponseHeadersMap,
  responseMap: uploadFileResponseMap,
  params: uploadFileParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;

export const serverRoute = {
  path: "/pet/{petId}/uploadImage",
  method: "post",
  operationId: "uploadFile",
  requestMap: uploadFileRequestMap,
  responseHeadersMap: uploadFileResponseHeadersMap,
  responseMap: uploadFileResponseMap,
  params: uploadFileServerParsedParams,
  isQueryOptional: true,
  isHeadersOptional: true,
} as const;