import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { HttpModel } from "../model/derive.ts";
import { ROUTES_FILE_PATH } from "../model/derive.ts";

export function renderRoutesFile(model: HttpModel): GeneratedFile {
  const imports: ImportDeclaration[] = [
    {
      from: "hono",
      names: ["Context"],
      typeOnly: true,
    },
    {
      from: "hono",
      names: ["Hono"],
    },
    {
      from: "./controllers.ts",
      names: ["createHttpControllers", "RequestValidationError"],
    },
    {
      from: "./controllers.ts",
      names: ["HttpControllers", "HttpUseCases"],
      typeOnly: true,
    },
  ];

  const routeRegistrations = model.operations
    .map((operation) => {
      const requestExpression = operation.hasJsonRequestBody
        ? "await jsonRequest(context)"
        : "request(context)";
      return [
        `  app.${operation.method}("${operation.honoPath}", async (context) =>`,
        `    respond(await controllers.${operation.operationId}(${requestExpression})),`,
        "  );",
      ].join("\n");
    })
    .join("\n");

  const statements = [
    [
      "type ApicalRequest = {",
      "  query: unknown;",
      "  path: unknown;",
      "  headers: unknown;",
      "  body?: unknown;",
      '  contentType?: "application/json";',
      "};",
    ].join("\n"),
    [
      "function request(context: Context): ApicalRequest {",
      "  return {",
      "    query: context.req.query(),",
      "    path: context.req.param(),",
      "    headers: context.req.raw.headers,",
      "  };",
      "}",
    ].join("\n"),
    [
      "async function jsonRequest(context: Context): Promise<ApicalRequest> {",
      '  const contentType = context.req.header("content-type")?.split(";", 1)[0]?.trim();',
      '  if (contentType !== "application/json") {',
      '    throw new RequestValidationError("body-error");',
      "  }",
      "",
      "  try {",
      "    return {",
      "      ...request(context),",
      "      body: await context.req.json(),",
      '      contentType: "application/json",',
      "    };",
      "  } catch {",
      '    throw new RequestValidationError("body-error");',
      "  }",
      "}",
    ].join("\n"),
    [
      "function respond(result: {",
      "  status: string;",
      '  contentType?: "application/json";',
      "  data?: unknown;",
      "}): Response {",
      "  const status = Number(result.status);",
      "  if (result.data === undefined) return new Response(null, { status });",
      "  return new Response(JSON.stringify(result.data), {",
      "    status,",
      '    headers: { "content-type": result.contentType ?? "application/json" },',
      "  });",
      "}",
    ].join("\n"),
    [
      "export function registerJsonRoutes(app: Hono, controllers: HttpControllers): void {",
      routeRegistrations,
      "}",
    ].join("\n"),
    [
      "export function createHonoApp(useCases: HttpUseCases): Hono {",
      "  const app = new Hono();",
      "  registerJsonRoutes(app, createHttpControllers(useCases));",
      "  app.onError((error, context) => {",
      "    if (error instanceof RequestValidationError) {",
      '      return context.json({ error: "Bad Request" }, 400);',
      "    }",
      '    return context.json({ error: "Internal Server Error" }, 500);',
      "  });",
      "  return app;",
      "}",
    ].join("\n"),
  ];

  return {
    path: ROUTES_FILE_PATH,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}
