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
        false,
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
        false,
      ),
    ).toEqual(["request.value.path.widgetId", "request.value.query?.status"]);
  });

  it("when only query parameters exist, then only query expressions are emitted", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: false, parameters: [{ name: "status", location: "query" }] },
        false,
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
        false,
      ),
    ).toEqual([
      "request.value.path.petId",
      "request.value.query?.name",
      "request.value.query?.status",
    ]);
  });

  it("when the operation has a JSON body, then the body expression replaces path parameters", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: false, parameters: [{ name: "itemId", location: "path" }] },
        true,
      ),
    ).toEqual(["request.value.body"]);
  });

  it("when the operation requires auth, then principal is the first argument", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: true, parameters: [{ name: "itemId", location: "path" }] },
        false,
      ),
    ).toEqual(["principal", "request.value.path.itemId"]);
    expect(deriveUseCaseArgumentExpressions({ requiresAuth: true, parameters: [] }, true)).toEqual([
      "principal",
      "request.value.body",
    ]);
  });

  it("when there are no parameters and no JSON body, then only an optional principal is emitted", () => {
    expect(
      deriveUseCaseArgumentExpressions({ requiresAuth: false, parameters: [] }, false),
    ).toEqual([]);
  });
});
