import type { ContractOperation } from "@hexkit/plugin-apical";

import { isXmlMediaType } from "./media-type.ts";

export type RequestBodyTransport =
  | { kind: "none" }
  | {
      kind: "json";
      contentTypes: readonly string[];
      /** Declared XML media types when the body also accepts XML alongside JSON. */
      xmlContentTypes?: readonly string[];
    }
  | { kind: "xml"; contentTypes: readonly [string, ...string[]] }
  | { kind: "binary"; contentTypes: readonly [string, ...string[]] };

/**
 * Classify an operation request body by the transport understood by Hexkit.
 *
 * Binary transport is determined by schema shape rather than media type, so
 * every `string` + `format: binary` entry contributes its declared content
 * type. XML transport is determined by media type (`application/xml`, with or
 * without parameters) on typed entries; XML may accompany JSON on the same
 * body (alternate media), which keeps `xmlContentTypes` on the JSON transport.
 *
 * @throws If a request body mixes JSON or XML with binary media, or has no
 *   supported typed media entry.
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
  const xmlContentTypes = requestBody.media
    .filter((entry) => entry.type !== undefined && isXmlMediaType(entry.mediaType))
    .map((entry) => entry.mediaType);

  if (
    binaryContentTypes.length > 0 &&
    (jsonContentTypes.length > 0 || xmlContentTypes.length > 0)
  ) {
    throw new Error(
      `Operation "${operation.operationId}" cannot declare both JSON or XML and binary request bodies.`,
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
    return {
      kind: "json",
      contentTypes: jsonContentTypes,
      ...(xmlContentTypes.length > 0 ? { xmlContentTypes } : {}),
    };
  }

  if (xmlContentTypes.length > 0) {
    const [firstXmlContentType, ...remainingXmlContentTypes] = xmlContentTypes;
    return {
      kind: "xml",
      contentTypes: [firstXmlContentType, ...remainingXmlContentTypes],
    };
  }

  throw new Error(
    `Operation "${operation.operationId}" request body must declare a typed application/json schema, a typed application/xml schema, or a string schema with format: binary.`,
  );
}
