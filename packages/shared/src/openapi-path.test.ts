import { describe, expect, it } from "vite-plus/test";

import {
  compareOpenApiRouteRegistrationOrder,
  extractOpenApiPathParamNames,
  openApiPathToHonoPath,
  openApiPathToNextSegments,
} from "./openapi-path.ts";

describe("Given OpenAPI path templates", () => {
  it("when parameters are extracted, then names appear in path order", () => {
    expect(extractOpenApiPathParamNames("/items/{itemId}/photos/{photoId}")).toEqual([
      "itemId",
      "photoId",
    ]);
    expect(extractOpenApiPathParamNames("/items")).toEqual([]);
    expect(extractOpenApiPathParamNames("/")).toEqual([]);
  });

  it("when rewritten for Hono, then braces become colon params", () => {
    expect(openApiPathToHonoPath("/items/{itemId}")).toBe("/items/:itemId");
    expect(openApiPathToHonoPath("/items/{itemId}/photos/{photoId}")).toBe(
      "/items/:itemId/photos/:photoId",
    );
    expect(openApiPathToHonoPath("/items")).toBe("/items");
  });

  it("when registration order is compared, then static paths sort before parameterized siblings", () => {
    const login = { path: "/user/login", operationId: "loginUser" };
    const byName = { path: "/user/{username}", operationId: "getUserByName" };
    const logout = { path: "/user/logout", operationId: "logoutUser" };

    expect(compareOpenApiRouteRegistrationOrder(login, byName)).toBeLessThan(0);
    expect(compareOpenApiRouteRegistrationOrder(byName, login)).toBeGreaterThan(0);
    expect(
      [byName, logout, login]
        .toSorted(compareOpenApiRouteRegistrationOrder)
        .map((operation) => operation.operationId),
    ).toEqual(["loginUser", "logoutUser", "getUserByName"]);
  });

  it("when split for Next.js, then dynamic segments are bracketed", () => {
    expect(openApiPathToNextSegments("/item/{itemId}/photos/{photoId}")).toEqual([
      "item",
      "[itemId]",
      "photos",
      "[photoId]",
    ]);
    expect(openApiPathToNextSegments("/")).toEqual([]);
    expect(openApiPathToNextSegments("/items")).toEqual(["items"]);
  });
});
