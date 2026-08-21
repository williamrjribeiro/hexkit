import { describe, expect, it } from "vite-plus/test";

import {
  openApiPathToAppRouteFile,
  openApiPathToAppRouteSegments,
  openApiPathToUiPageFile,
  relativeImportPath,
} from "./paths.ts";

describe("Given OpenAPI paths", () => {
  it("when mapped for both, then handlers use contract paths and UI uses /ui prefix", () => {
    expect(openApiPathToAppRouteFile("/pet/{petId}")).toBe("app/pet/[petId]/route.ts");
    expect(openApiPathToUiPageFile("/pet/{petId}", { surface: "both" })).toBe(
      "app/ui/pet/[petId]/page.tsx",
    );
  });

  it("when mapped for rsc-only, then pages use contract paths", () => {
    expect(openApiPathToUiPageFile("/pet/{petId}", { surface: "rsc" })).toBe(
      "app/pet/[petId]/page.tsx",
    );
  });

  it("when openApiPathToAppRouteSegments is used, then dynamic segments are bracketed", () => {
    expect(openApiPathToAppRouteSegments("/item/{itemId}/photos/{photoId}")).toEqual([
      "item",
      "[itemId]",
      "photos",
      "[photoId]",
    ]);
    expect(openApiPathToAppRouteSegments("/")).toEqual([]);
    expect(openApiPathToAppRouteFile("/")).toBe("app/route.ts");
    expect(openApiPathToUiPageFile("/", { surface: "both" })).toBe("app/ui/page.tsx");
    expect(openApiPathToUiPageFile("/", { surface: "rsc" })).toBe("app/page.tsx");
  });
});

describe("Given generated file paths", () => {
  it("when relativeImportPath targets a same-directory file, then a ./ prefix is added", () => {
    expect(
      relativeImportPath(
        "src/adapters/http-next/runtime.ts",
        "src/adapters/http-next/controllers.ts",
      ),
    ).toBe("./controllers.ts");
  });
});

describe("Given OpenAPI paths", () => {
  it("when mapped for both, then handlers use contract paths and UI uses /ui prefix", () => {
    expect(openApiPathToAppRouteFile("/pet/{petId}")).toBe("app/pet/[petId]/route.ts");
    expect(openApiPathToUiPageFile("/pet/{petId}", { surface: "both" })).toBe(
      "app/ui/pet/[petId]/page.tsx",
    );
  });

  it("when mapped for rsc-only, then pages use contract paths", () => {
    expect(openApiPathToUiPageFile("/pet/{petId}", { surface: "rsc" })).toBe(
      "app/pet/[petId]/page.tsx",
    );
  });
});
