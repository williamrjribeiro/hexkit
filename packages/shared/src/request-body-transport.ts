import type { ContractOperation } from "@hexkit/plugin-apical";

export type RequestBodyTransport =
  | { kind: "none" }
  | { kind: "json"; contentTypes: readonly string[] }
  | { kind: "binary"; contentTypes: readonly [string, ...string[]] };

/**
 * Classify an operation request body by the transport understood by Hexkit.
 *
 * Binary transport is determined by schema shape rather than media type, so
 * every `string` + `format: binary` entry contributes its declared content
 * type.
 *
 * @throws If a request body mixes JSON and binary media, or has no supported
 *   typed media entry.
 */
export function deriveRequestBodyTransport(operation: ContractOperation): RequestBodyTransport {
  const requestBody = operation.requestBody;
  if (requestBody === undefined) {
    return { kind: "none" };
  }

  const binaryContentTypes = requestBody.media
    .filter((entry) => entry.type?.kind === "string" && entry.type.format === "binary")
    .map((entry) => entry.mediaType);
  const jsonContentTypes = requestBody.media
    .filter((entry) => entry.mediaType === "application/json" && entry.type !== undefined)
    .map((entry) => entry.mediaType);

  if (jsonContentTypes.length > 0 && binaryContentTypes.length > 0) {
    throw new Error(
      `Operation "${operation.operationId}" cannot declare both JSON and binary request bodies.`,
    );
  }

  const [firstBinaryContentType, ...remainingBinaryContentTypes] = binaryContentTypes;
  if (firstBinaryContentType !== undefined) {
    return {
      kind: "binary",
      contentTypes: [firstBinaryContentType, ...remainingBinaryContentTypes],
    };
  }

  if (jsonContentTypes.length > 0) {
    return { kind: "json", contentTypes: jsonContentTypes };
  }

  throw new Error(
    `Operation "${operation.operationId}" request body must declare a typed application/json schema or a string schema with format: binary.`,
  );
}
