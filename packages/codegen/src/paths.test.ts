import { describe, expect, it } from "vite-plus/test";

import { relativeImportPath } from "./paths.ts";

describe("Given generated file paths", () => {
  it("when the target is in a sibling directory, then the specifier is relative", () => {
    expect(
      relativeImportPath("src/adapters/http/routes.ts", "src/core/ports/pet-repository.ts"),
    ).toBe("../../core/ports/pet-repository.ts");
  });

  it("when the target is in the same directory, then the specifier is dotted", () => {
    expect(relativeImportPath("src/a.ts", "src/b.ts")).toBe("./b.ts");
  });
});
