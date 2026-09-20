import { describe, expect, it } from "vite-plus/test";

import { deriveUseCaseArgumentExpressions } from "./use-case-args.ts";

describe("Given use-case argument derivation", () => {
  it("when the operation is public with path parameters, then only path expressions are emitted", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        {
          requiresAuth: false,
          parameters: [
            { name: "itemId", location: "path" },
            { name: "photoId", location: "path" },
          ],
        },
        { hasJsonRequestBody: false, hasBinaryRequestBody: false },
      ),
    ).toEqual(["request.value.path.itemId", "request.value.path.photoId"]);
  });

  it("when query parameters are present, then query expressions follow path expressions", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        {
          requiresAuth: false,
          parameters: [
            { name: "widgetId", location: "path" },
            { name: "status", location: "query" },
          ],
        },
        { hasJsonRequestBody: false, hasBinaryRequestBody: false },
      ),
    ).toEqual(["request.value.path.widgetId", "request.value.query?.status"]);
  });

  it("when only query parameters exist, then only query expressions are emitted", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: false, parameters: [{ name: "status", location: "query" }] },
        { hasJsonRequestBody: false, hasBinaryRequestBody: false },
      ),
    ).toEqual(["request.value.query?.status"]);
  });

  it("when all query fields are optional, then expressions use optional chaining on the query bag", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        {
          requiresAuth: false,
          parameters: [
            { name: "petId", location: "path" },
            { name: "name", location: "query" },
            { name: "status", location: "query" },
          ],
        },
        { hasJsonRequestBody: false, hasBinaryRequestBody: false },
      ),
    ).toEqual([
      "request.value.path.petId",
      "request.value.query?.name",
      "request.value.query?.status",
    ]);
  });

  it("when the operation has a JSON body, then path and query expressions precede the body", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        {
          requiresAuth: false,
          parameters: [{ name: "sku", location: "path" }, { name: "item" }],
        },
        { hasJsonRequestBody: true, hasBinaryRequestBody: false },
      ),
    ).toEqual(["request.value.path.sku", "request.value.body"]);
  });

  it("when the operation has only a JSON body, then only the body expression is emitted", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: false, parameters: [{ name: "item" }] },
        { hasJsonRequestBody: true, hasBinaryRequestBody: false },
      ),
    ).toEqual(["request.value.body"]);
  });

  it("when the operation requires auth, then principal is the first argument", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: true, parameters: [{ name: "itemId", location: "path" }] },
        { hasJsonRequestBody: false, hasBinaryRequestBody: false },
      ),
    ).toEqual(["principal", "request.value.path.itemId"]);
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: true, parameters: [] },
        { hasJsonRequestBody: true, hasBinaryRequestBody: false },
      ),
    ).toEqual(["principal", "request.value.body"]);
  });

  it("when there are no parameters and no JSON body, then only an optional principal is emitted", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: false, parameters: [] },
        { hasJsonRequestBody: false, hasBinaryRequestBody: false },
      ),
    ).toEqual([]);
  });

  it("when the operation has a binary body, then content type and body follow path expressions", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        {
          requiresAuth: false,
          parameters: [{ name: "widgetId", location: "path" }],
        },
        { hasJsonRequestBody: false, hasBinaryRequestBody: true },
      ),
    ).toEqual([
      "request.value.path.widgetId",
      "apicalRequest.contentType!",
      "new Uint8Array(await request.value.body.arrayBuffer())",
    ]);
  });
});
