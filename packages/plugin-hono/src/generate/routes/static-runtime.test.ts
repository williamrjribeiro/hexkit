import { describe, expect, it } from "vite-plus/test";

import { renderOnErrorHandler, renderStaticRuntimeStatements } from "./static-runtime.ts";

describe("Given an unauthenticated app", () => {
  it("when renderOnErrorHandler runs, then it maps validation errors to 400", () => {
    expect(renderOnErrorHandler({ hasAuth: false })).toBe(
      [
        "  app.onError((error, context) => {",
        "    if (error instanceof RequestValidationError) {",
        '      return context.json({ error: "Bad Request" }, 400);',
        "    }",
        '    return context.json({ error: "Internal Server Error" }, 500);',
        "  });",
      ].join("\n"),
    );
  });

  it("when static runtime is rendered, then request helpers use Context", () => {
    const source = renderStaticRuntimeStatements({ hasAuth: false, hasXmlRuntime: false }).join(
      "\n",
    );
    expect(source).toContain("function toApicalHeaders(headers: Headers)");
    expect(source).toContain("function toApicalQuery(");
    expect(source).toContain(
      "function request(context: Context, arrayQueryKeys: readonly string[] = []): ApicalRequest",
    );
    expect(source).toContain(
      "async function jsonRequest(context: Context, arrayQueryKeys: readonly string[] = []): Promise<JsonApicalRequest>",
    );
    expect(source).toContain(
      "async function binaryRequest<const ContentTypes extends readonly string[]>(",
    );
    expect(source).not.toContain("createAuthenticateMiddleware");
    expect(source).not.toContain("AppBindings");
    expect(source).toContain("headers[name] = String(value)");
  });

  it("when no operation uses XML, then the XML runtime stays out of the source", () => {
    const source = renderStaticRuntimeStatements({ hasAuth: false, hasXmlRuntime: false }).join(
      "\n",
    );

    expect(source).not.toContain("XMLParser");
    expect(source).not.toContain("parseXmlPayload");
    expect(source).not.toContain("serializeXmlPayload");
    expect(source).not.toContain("prefersXmlResponse");
    expect(source).not.toContain("function xmlRequest");
    expect(source).not.toContain("function typedRequest");
    expect(source).not.toContain("XmlApicalRequest");
    expect(source).not.toContain("xmlRoot !== undefined");
  });

  it("when an operation uses XML, then parse, serialize, and negotiation helpers are emitted", () => {
    const source = renderStaticRuntimeStatements({ hasAuth: false, hasXmlRuntime: true }).join(
      "\n",
    );

    expect(source).toContain("type XmlApicalRequest<ContentType extends string = string>");
    expect(source).toContain("function parseXmlPayload(text: string): unknown");
    expect(source).toContain("function serializeXmlPayload(data: unknown, rootName: string)");
    expect(source).toContain("function prefersXmlResponse(accept: string | undefined): boolean");
    expect(source).toContain(
      "async function xmlRequest<const ContentTypes extends readonly string[]>(",
    );
    expect(source).toContain(
      "async function typedRequest<const JsonTypes extends readonly string[], const XmlTypes extends readonly string[]>(",
    );
    expect(source).toContain("body: parseXmlPayload(text)");
    expect(source).toContain("if (result.xmlRoot !== undefined && prefersXmlResponse(accept))");
    expect(source).toContain('headers["content-type"] = "application/xml"');
  });
});

describe("Given an authenticated app", () => {
  it("when renderOnErrorHandler runs, then it maps AuthenticationError to 401 first", () => {
    expect(renderOnErrorHandler({ hasAuth: true })).toBe(
      [
        "  app.onError((error, context) => {",
        "    if (error instanceof AuthenticationError) {",
        '      return context.json({ error: "Unauthorized" }, 401);',
        "    }",
        "    if (error instanceof RequestValidationError) {",
        '      return context.json({ error: "Bad Request" }, 400);',
        "    }",
        '    return context.json({ error: "Internal Server Error" }, 500);',
        "  });",
      ].join("\n"),
    );
  });

  it("when static runtime is rendered, then auth middleware helpers are included", () => {
    const source = renderStaticRuntimeStatements({ hasAuth: true, hasXmlRuntime: false }).join(
      "\n",
    );
    expect(source).toContain("type AppVariables = { principal: Principal };");
    expect(source).toContain(
      "function request(context: AppContext, arrayQueryKeys: readonly string[] = []): ApicalRequest",
    );
    expect(source).toContain("function extractCredentials(");
    expect(source).toContain("function createAuthenticateMiddleware(");
  });
});
