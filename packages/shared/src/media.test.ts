import { describe, expect, it } from "vite-plus/test";

import type { ContractOperation } from "@hexkit/plugin-apical";

import {
  findJsonMedia,
  findSuccessResponse,
  hasJsonRequestBody,
  hasNotFoundResponse,
} from "./media.ts";

const stringType = { kind: "string", nullable: false } as const;
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
});
