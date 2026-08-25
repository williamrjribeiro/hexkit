import type {
  ContractArtifact,
  ContractMedia,
  ContractOperation,
  ContractResponse,
} from "@hexkit/plugin-apical";

import { isSuccessStatus } from "./status.ts";

/**
 * First `application/json` media entry that declares a schema type.
 *
 * Entries that name `application/json` but omit `type` are ignored so adapters
 * never bind an empty body as JSON.
 *
 * @param media - Request or response media list. `undefined` is treated as empty.
 */
export function findJsonMedia(
  media: readonly ContractMedia[] | undefined,
): ContractMedia | undefined {
  return media?.find((entry) => entry.mediaType === "application/json" && entry.type !== undefined);
}

/**
 * First 2xx response on `operation`, in contract order.
 *
 * @param operation - Contract operation whose responses are searched.
 */
export function findSuccessResponse(operation: ContractOperation): ContractResponse | undefined {
  return operation.responses.find((response) => isSuccessStatus(response.status));
}

/**
 * True when the operation declares a JSON request body with a schema type.
 *
 * @param operation - Contract operation to inspect.
 */
export function hasJsonRequestBody(operation: ContractOperation): boolean {
  return findJsonMedia(operation.requestBody?.media) !== undefined;
}

/**
 * True when the operation declares a `404` response.
 *
 * @param operation - Contract operation to inspect.
 */
export function hasNotFoundResponse(operation: ContractOperation): boolean {
  return operation.responses.some((response) => response.status === "404");
}

/** Contract security scheme union taken from the published artifact type. */
export type ContractSecurityScheme = ContractArtifact["securitySchemes"][number];
