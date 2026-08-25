import { describe, expect, it } from "vite-plus/test";

import { deriveUseCaseArgumentExpressions } from "./use-case-args.ts";

describe("Given use-case argument derivation", () => {
  it("when the operation is public with path parameters, then only path expressions are emitted", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: false, parameters: [{ name: "itemId" }, { name: "photoId" }] },
        false,
      ),
    ).toEqual(["request.value.path.itemId", "request.value.path.photoId"]);
  });

  it("when the operation has a JSON body, then the body expression replaces path parameters", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: false, parameters: [{ name: "itemId" }] },
        true,
      ),
    ).toEqual(["request.value.body"]);
  });

  it("when the operation requires auth, then principal is the first argument", () => {
    expect(
      deriveUseCaseArgumentExpressions(
        { requiresAuth: true, parameters: [{ name: "itemId" }] },
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
