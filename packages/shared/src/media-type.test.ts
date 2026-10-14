import { describe, expect, it } from "vite-plus/test";

import { isXmlMediaType } from "./media-type.ts";

describe("Given isXmlMediaType", () => {
  it("when the media type is plain application/xml, then it matches", () => {
    expect(isXmlMediaType("application/xml")).toBe(true);
  });

  it("when parameters follow the type, then the type still matches", () => {
    expect(isXmlMediaType("application/xml; charset=utf-8")).toBe(true);
  });

  it("when casing differs, then the type still matches", () => {
    expect(isXmlMediaType("Application/XML")).toBe(true);
    expect(isXmlMediaType(" APPLICATION/XML ")).toBe(true);
  });

  it("when the media type is another type, then it does not match", () => {
    expect(isXmlMediaType("application/json")).toBe(false);
    expect(isXmlMediaType("text/xml")).toBe(false);
    expect(isXmlMediaType("application/xhtml+xml")).toBe(false);
    expect(isXmlMediaType("application/xmlish")).toBe(false);
  });
});
