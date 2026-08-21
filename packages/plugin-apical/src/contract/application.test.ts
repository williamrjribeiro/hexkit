import { describe, expect, it } from "vite-plus/test";

import { normalizeApplication } from "./application.ts";

describe("Given OpenAPI info", () => {
  it("when title contains letters, then slug is NFKD kebab-case", () => {
    expect(
      normalizeApplication({ title: "Café Books!", version: "1.0.0", description: "A library" }),
    ).toEqual({
      title: "Café Books!",
      version: "1.0.0",
      slug: "cafe-books",
      description: "A library",
    });
  });

  it("when title has no alphanumeric characters, then normalization fails", () => {
    expect(() => normalizeApplication({ title: "!!!", version: "1.0.0" })).toThrow(
      "OpenAPI info.title must contain at least one letter or number.",
    );
  });
});
