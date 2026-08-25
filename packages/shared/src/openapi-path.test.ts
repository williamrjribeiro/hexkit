import { describe, expect, it } from "vite-plus/test";

import {
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
