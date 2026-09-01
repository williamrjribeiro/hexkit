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
    const source = renderStaticRuntimeStatements({ hasAuth: false }).join("\n");
    expect(source).toContain("function toApicalHeaders(headers: Headers)");
    expect(source).toContain("function toApicalQuery(");
    expect(source).toContain(
      "function request(context: Context, arrayQueryKeys: readonly string[] = []): ApicalRequest",
    );
    expect(source).toContain(
      "async function jsonRequest(context: Context, arrayQueryKeys: readonly string[] = []): Promise<ApicalRequest>",
    );
    expect(source).not.toContain("createAuthenticateMiddleware");
    expect(source).not.toContain("AppBindings");
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
    const source = renderStaticRuntimeStatements({ hasAuth: true }).join("\n");
    expect(source).toContain("type AppVariables = { principal: Principal };");
    expect(source).toContain(
      "function request(context: AppContext, arrayQueryKeys: readonly string[] = []): ApicalRequest",
    );
    expect(source).toContain("function extractCredentials(");
    expect(source).toContain("function createAuthenticateMiddleware(");
  });
});
