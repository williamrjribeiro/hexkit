import { describe, expect, it } from "vite-plus/test";

import type { ContractOperation } from "@hexkit/plugin-apical";

import {
  findJsonMedia,
  findOctetStreamMedia,
  findSuccessResponse,
  findXmlMedia,
  hasBinaryRequestBody,
  hasJsonRequestBody,
  hasXmlRequestBody,
  hasNotFoundResponse,
  isXmlMediaType,
} from "./media.ts";

const stringType = { kind: "string", nullable: false } as const;
const binaryType = { kind: "string", nullable: false, format: "binary" } as const;
const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;

const publicSecurity = {
  overridesGlobal: true,
  requirements: [] as const,
  apicalServerHeaderNames: [] as const,
};

function operation(
  overrides: Partial<ContractOperation> & Pick<ContractOperation, "operationId">,
): ContractOperation {
  return {
    method: "get",
    path: "/items",
    modulePath: `routes/${overrides.operationId}.ts`,
    parameters: [],
    responses: [{ status: "200", description: "ok", media: [] }],
    security: publicSecurity,
    ...overrides,
  };
}

describe("Given contract media lists", () => {
  it("when a JSON entry has a type, then that entry is returned", () => {
    expect(
      findJsonMedia([
        { mediaType: "text/plain", type: stringType },
        { mediaType: "application/json", type: itemReference },
      ]),
    ).toEqual({ mediaType: "application/json", type: itemReference });
  });

  it("when JSON is present without a type, then the result is undefined", () => {
    expect(findJsonMedia([{ mediaType: "application/json" }])).toBeUndefined();
  });

  it("when the list is missing or empty, then the result is undefined", () => {
    expect(findJsonMedia(undefined)).toBeUndefined();
    expect(findJsonMedia([])).toBeUndefined();
  });
});

describe("Given XML media detection", () => {
  it("when the media type is application/xml, then it is XML", () => {
    expect(isXmlMediaType("application/xml")).toBe(true);
    expect(isXmlMediaType("application/xml; charset=utf-8")).toBe(true);
    expect(isXmlMediaType("Application/XML")).toBe(true);
  });

  it("when the media type is not XML, then it is not XML", () => {
    expect(isXmlMediaType("application/json")).toBe(false);
    expect(isXmlMediaType("text/xml")).toBe(false);
    expect(isXmlMediaType("application/xhtml+xml")).toBe(false);
  });

  it("when an XML entry has a type, then that entry is returned", () => {
    expect(
      findXmlMedia([
        { mediaType: "application/json", type: itemReference },
        { mediaType: "application/xml", type: stringType },
      ]),
    ).toEqual({ mediaType: "application/xml", type: stringType });
  });

  it("when XML is present without a type, then the result is undefined", () => {
    expect(findXmlMedia([{ mediaType: "application/xml" }])).toBeUndefined();
    expect(findXmlMedia(undefined)).toBeUndefined();
  });

  it("when the operation declares an XML request body, then hasXmlRequestBody is true", () => {
    expect(
      hasXmlRequestBody(
        operation({
          operationId: "createWidget",
          requestBody: {
            required: true,
            media: [{ mediaType: "application/xml", type: itemReference }],
          },
        }),
      ),
    ).toBe(true);
  });

  it("when the operation has no XML request body, then hasXmlRequestBody is false", () => {
    expect(
      hasXmlRequestBody(
        operation({
          operationId: "createWidget",
          requestBody: {
            required: true,
            media: [{ mediaType: "application/json", type: itemReference }],
          },
        }),
      ),
    ).toBe(false);
    expect(hasXmlRequestBody(operation({ operationId: "listWidgets" }))).toBe(false);
  });
});

describe("Given contract operation responses", () => {
  it("when multiple statuses exist, then the first 2xx response wins", () => {
    const result = findSuccessResponse(
      operation({
        operationId: "createItem",
        responses: [
          { status: "404", description: "missing", media: [] },
          { status: "201", description: "created", media: [{ mediaType: "application/json" }] },
          { status: "200", description: "ok", media: [] },
        ],
      }),
    );

    expect(result?.status).toBe("201");
  });

  it("when only error statuses exist, then success is undefined", () => {
    expect(
      findSuccessResponse(
        operation({
          operationId: "missing",
          responses: [{ status: "404", description: "missing", media: [] }],
        }),
      ),
    ).toBeUndefined();
  });

  it("when a 404 is declared, then hasNotFoundResponse is true", () => {
    expect(
      hasNotFoundResponse(
        operation({
          operationId: "getItem",
          responses: [
            { status: "200", description: "ok", media: [] },
            { status: "404", description: "missing", media: [] },
          ],
        }),
      ),
    ).toBe(true);
    expect(hasNotFoundResponse(operation({ operationId: "listItems" }))).toBe(false);
  });
});

describe("Given a request body", () => {
  it("when JSON media includes a type, then hasJsonRequestBody is true", () => {
    expect(
      hasJsonRequestBody(
        operation({
          operationId: "createItem",
          method: "post",
          requestBody: {
            required: true,
            media: [{ mediaType: "application/json", type: itemReference }],
          },
        }),
      ),
    ).toBe(true);
  });

  it("when the body is missing or not JSON with a schema, then hasJsonRequestBody is false", () => {
    expect(hasJsonRequestBody(operation({ operationId: "listItems" }))).toBe(false);
    expect(
      hasJsonRequestBody(
        operation({
          operationId: "upload",
          method: "post",
          requestBody: {
            required: true,
            media: [{ mediaType: "multipart/form-data", type: stringType }],
          },
        }),
      ),
    ).toBe(false);
  });

  it("finds any media type with a binary schema", () => {
    const media = findOctetStreamMedia([
      {
        mediaType: "image/png",
        type: binaryType,
      },
    ]);
    expect(media?.mediaType).toBe("image/png");
  });

  it("hasBinaryRequestBody is true for non-octet-stream binary operations", () => {
    expect(
      hasBinaryRequestBody(
        operation({
          operationId: "uploadDocument",
          method: "post",
          path: "/widgets/{widgetId}/documents",
          requestBody: {
            required: true,
            media: [{ mediaType: "image/jpeg", type: binaryType }],
          },
        }),
      ),
    ).toBe(true);
  });
});
