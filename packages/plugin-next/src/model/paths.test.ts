import { describe, expect, it } from "vite-plus/test";
import { openApiPathToAppRouteFile, openApiPathToUiPageFile } from "./paths.ts";

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
