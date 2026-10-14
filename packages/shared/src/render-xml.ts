import type { ImportDeclaration } from "@hexkit/codegen";

import type { RequestBodyTransport } from "./request-body-transport.ts";

/**
 * Import declaration for the emitted XML runtime helpers. Adapters add this to
 * their generated runtime module when any operation declares XML media.
 */
export const XML_RUNTIME_IMPORT: ImportDeclaration = {
  from: "fast-xml-parser",
  names: ["XMLBuilder", "XMLParser"],
};

/**
 * True when a bound controller operation touches XML media: an XML request
 * body (XML-only or alongside JSON), or a success response that can serialize
 * XML.
 *
 * @param binding - Controller binding fields that carry XML capability.
 */
export function usesXmlMedia(binding: {
  readonly successXmlRootName?: string;
  readonly requestBodyTransport: RequestBodyTransport;
}): boolean {
  return (
    binding.successXmlRootName !== undefined ||
    binding.requestBodyTransport.kind === "xml" ||
    (binding.requestBodyTransport.kind === "json" &&
      binding.requestBodyTransport.xmlContentTypes !== undefined)
  );
}

/**
 * Render the XML parse/serialize/negotiate helpers emitted into adapter
 * runtime modules (Hono `routes.ts`, Next `helpers.ts`).
 *
 * The emitted code depends on `XML_RUNTIME_IMPORT` being present in the same
 * module. XML documents are a faithful rendering of the contract JSON shape:
 * objects nest, arrays repeat the element, scalars become text. Schema-level
 * `xml` object features (name, wrapped, namespaces) are out of scope.
 */
export function renderXmlRuntimeStatements(): string[] {
  return [
    [
      "const xmlParser = new XMLParser({ ignoreAttributes: true, trimValues: true });",
      "const xmlBuilder = new XMLBuilder({ ignoreAttributes: true, format: false });",
    ].join("\n"),
    [
      "function parseXmlPayload(text: string): unknown {",
      "  const parsed = xmlParser.parse(text) as Record<string, unknown>;",
      "  const rootKey = Object.keys(parsed)[0];",
      '  if (rootKey === undefined) throw new Error("xml-root-missing");',
      "  return parsed[rootKey];",
      "}",
    ].join("\n"),
    [
      "function serializeXmlPayload(data: unknown, rootName: string): string {",
      "  return xmlBuilder.build({ [rootName]: data });",
      "}",
    ].join("\n"),
    [
      "function prefersXmlResponse(accept: string | undefined): boolean {",
      "  if (accept === undefined) return false;",
      '  const entries = accept.split(",").map((entry) => entry.split(";", 1)[0]?.trim().toLowerCase());',
      '  const xmlIndex = entries.indexOf("application/xml");',
      "  if (xmlIndex === -1) return false;",
      '  const jsonIndex = entries.indexOf("application/json");',
      "  if (jsonIndex === -1) return true;",
      "  return xmlIndex < jsonIndex;",
      "}",
    ].join("\n"),
  ];
}
