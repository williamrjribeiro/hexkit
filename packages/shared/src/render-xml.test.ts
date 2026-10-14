import { describe, expect, it } from "vite-plus/test";

import { renderXmlRuntimeStatements, XML_RUNTIME_IMPORT } from "./render-xml.ts";

describe("Given the XML runtime renderer", () => {
  it("when statements are rendered, then parse, serialize, and negotiation helpers are present", () => {
    const source = renderXmlRuntimeStatements().join("\n");

    expect(source).toContain("new XMLParser({ ignoreAttributes: true, trimValues: true })");
    expect(source).toContain("new XMLBuilder({ ignoreAttributes: true, format: false })");
    expect(source).toContain("function parseXmlPayload(text: string): unknown {");
    expect(source).toContain(
      "function serializeXmlPayload(data: unknown, rootName: string): string {",
    );
    expect(source).toContain("function prefersXmlResponse(accept: string | undefined): boolean {");
  });

  it("when negotiation runs, then explicit XML wins and defaults stay JSON", () => {
    const source = renderXmlRuntimeStatements().join("\n");

    expect(source).toContain('entries.indexOf("application/xml")');
    expect(source).toContain('entries.indexOf("application/json")');
    expect(source).toContain("return xmlIndex < jsonIndex;");
    // Absent or wildcard Accept headers never select XML (JSON stays the default).
    expect(source).toContain("if (accept === undefined) return false;");
  });

  it("when the import is rendered, then fast-xml-parser provides the parser and builder", () => {
    expect(XML_RUNTIME_IMPORT).toEqual({
      from: "fast-xml-parser",
      names: ["XMLBuilder", "XMLParser"],
    });
  });
});
