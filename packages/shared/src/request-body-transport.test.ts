import { describe, expect, it } from "vite-plus/test";

import type { ContractOperation } from "@hexkit/plugin-apical";

import { deriveRequestBodyTransport } from "./request-body-transport.ts";

const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;
const binaryType = { kind: "string", nullable: false, format: "binary" } as const;

const publicSecurity = {
  overridesGlobal: true,
  requirements: [] as const,
  apicalServerHeaderNames: [] as const,
};

function operation(
  overrides: Partial<ContractOperation> & Pick<ContractOperation, "operationId">,
): ContractOperation {
  return {
    method: "post",
    path: "/documents",
    modulePath: `routes/${overrides.operationId}.ts`,
    parameters: [],
    responses: [{ status: "204", description: "ok", media: [] }],
    security: publicSecurity,
    ...overrides,
  };
}

describe("Given request body transport derivation", () => {
  it("when no request body exists, then transport is none", () => {
    expect(deriveRequestBodyTransport(operation({ operationId: "listDocuments" }))).toEqual({
      kind: "none",
    });
  });

  it("when typed JSON media exists, then transport includes its content type", () => {
    expect(
      deriveRequestBodyTransport(
        operation({
          operationId: "createDocument",
          requestBody: {
            required: true,
            media: [{ mediaType: "application/json", type: itemReference }],
          },
        }),
      ),
    ).toEqual({ kind: "json", contentTypes: ["application/json"] });
  });

  it("when multiple format:binary media exist, then transport includes every content type", () => {
    expect(
      deriveRequestBodyTransport(
        operation({
          operationId: "uploadDocument",
          requestBody: {
            required: true,
            media: [
              { mediaType: "application/octet-stream", type: binaryType },
              { mediaType: "image/png", type: binaryType },
              { mediaType: "image/jpeg", type: binaryType },
            ],
          },
        }),
      ),
    ).toEqual({
      kind: "binary",
      contentTypes: ["application/octet-stream", "image/png", "image/jpeg"],
    });
  });

  it("when request media omit schemas, then derivation rejects the body", () => {
    expect(() =>
      deriveRequestBodyTransport(
        operation({
          operationId: "uploadDocument",
          requestBody: {
            required: true,
            media: [{ mediaType: "image/png" }],
          },
        }),
      ),
    ).toThrow(/schema|format: binary/i);
  });

  it("when JSON and binary media coexist, then derivation rejects the body", () => {
    expect(() =>
      deriveRequestBodyTransport(
        operation({
          operationId: "invalidUpload",
          requestBody: {
            required: true,
            media: [
              { mediaType: "application/json", type: itemReference },
              { mediaType: "image/png", type: binaryType },
            ],
          },
        }),
      ),
    ).toThrow(/both JSON or XML and binary request bodies/i);
  });

  it("when typed XML media exists alone, then transport is xml with its content type", () => {
    expect(
      deriveRequestBodyTransport(
        operation({
          operationId: "setWidgetLabel",
          requestBody: {
            required: true,
            media: [{ mediaType: "application/xml", type: itemReference }],
          },
        }),
      ),
    ).toEqual({ kind: "xml", contentTypes: ["application/xml"] });
  });

  it("when JSON and XML media coexist, then JSON transport carries the XML content types", () => {
    expect(
      deriveRequestBodyTransport(
        operation({
          operationId: "createWidget",
          requestBody: {
            required: true,
            media: [
              { mediaType: "application/json", type: itemReference },
              { mediaType: "application/xml", type: itemReference },
            ],
          },
        }),
      ),
    ).toEqual({
      kind: "json",
      contentTypes: ["application/json"],
      xmlContentTypes: ["application/xml"],
    });
  });

  it("when XML media carries charset parameters, then detection is case-insensitive", () => {
    expect(
      deriveRequestBodyTransport(
        operation({
          operationId: "createWidget",
          requestBody: {
            required: true,
            media: [
              { mediaType: "application/xml; charset=utf-8", type: itemReference },
              { mediaType: "Application/XML", type: itemReference },
            ],
          },
        }),
      ),
    ).toEqual({
      kind: "xml",
      contentTypes: ["application/xml; charset=utf-8", "Application/XML"],
    });
  });

  it("when XML and binary media coexist, then derivation rejects the body", () => {
    expect(() =>
      deriveRequestBodyTransport(
        operation({
          operationId: "invalidXmlUpload",
          requestBody: {
            required: true,
            media: [
              { mediaType: "application/xml", type: itemReference },
              { mediaType: "image/png", type: binaryType },
            ],
          },
        }),
      ),
    ).toThrow(/both JSON or XML and binary request bodies/i);
  });
});
