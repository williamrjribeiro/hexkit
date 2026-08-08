import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { HttpModel } from "../model/derive.ts";
import { ROUTES_FILE_PATH } from "../model/derive.ts";

export function renderRoutesFile(model: HttpModel): GeneratedFile {
  const hasAuth = model.authenticator !== undefined;
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
    ...(hasAuth
      ? [
          {
            from: "hono/factory",
            names: ["createMiddleware"],
          },
          {
            from: "../../core/domain/auth-principal.ts",
            names: ["Principal"],
            typeOnly: true,
          },
          {
            from: "../../core/ports/authenticator.ts",
            names: ["AuthCredentials", "Authenticator"],
            typeOnly: true,
          },
        ]
      : []),
    {
      from: "./controllers.ts",
      names: [
        "createHttpControllers",
        ...(hasAuth ? ["AuthenticationError"] : []),
        "RequestValidationError",
      ],
    },
    {
      from: "./controllers.ts",
      names: ["HttpControllers", "HttpUseCases"],
      typeOnly: true,
    },
  ];

  const routeRegistrations = model.operations.map(renderRouteRegistration).join("\n");

  const statements = [
    ...(hasAuth
      ? [
          "type AppVariables = { principal: Principal };",
          "type AppBindings = { Variables: AppVariables };",
          "type AppContext = Context<AppBindings>;",
        ]
      : []),
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
      "function toApicalHeaders(headers: Headers): Record<string, string> {",
      "  const result: Record<string, string> = {};",
      "  headers.forEach((value, key) => {",
      "    result[key.toLowerCase()] = value;",
      "  });",
      "  return result;",
      "}",
    ].join("\n"),
    [
      `function request(context: ${hasAuth ? "AppContext" : "Context"}): ApicalRequest {`,
      "  return {",
      "    query: context.req.query(),",
      "    path: context.req.param(),",
      "    headers: toApicalHeaders(context.req.raw.headers),",
      "  };",
      "}",
    ].join("\n"),
    [
      `async function jsonRequest(context: ${hasAuth ? "AppContext" : "Context"}): Promise<ApicalRequest> {`,
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
    ...(hasAuth
      ? [
          [
            "type SecuritySchemeMeta =",
            '  | { name: string; type: "apiKey"; headerName: string }',
            '  | { name: string; type: "http"; scheme: "bearer"; headerName: "Authorization" };',
          ].join("\n"),
          [
            "type OperationSecurityMeta = {",
            "  schemes: readonly SecuritySchemeMeta[];",
            "};",
          ].join("\n"),
          [
            "function extractCredentials(",
            "  headers: Headers,",
            "  securityMeta: OperationSecurityMeta,",
            "): AuthCredentials | undefined {",
            "  for (const scheme of securityMeta.schemes) {",
            '    if (scheme.type === "http" && scheme.scheme === "bearer") {',
            "      const value = headers.get(scheme.headerName);",
            "      if (value === null) continue;",
            "      const bearerMatch = /^Bearer\\s+(.+)$/i.exec(value.trim());",
            "      if (bearerMatch === null) continue;",
            '      const token = bearerMatch[1]?.trim() ?? "";',
            "      if (token.length === 0) continue;",
            '      return { kind: "bearer", schemeName: scheme.name, token };',
            "    }",
            "",
            "    const apiKey = headers.get(scheme.headerName);",
            "    if (apiKey === null || apiKey.trim().length === 0) continue;",
            '    return { kind: "apiKey", schemeName: scheme.name, headerName: scheme.headerName.toLowerCase(), apiKey };',
            "  }",
            "",
            "  return undefined;",
            "}",
          ].join("\n"),
          [
            "function createAuthenticateMiddleware(",
            "  authenticator: Authenticator,",
            "  securityMeta: OperationSecurityMeta,",
            ") {",
            "  return createMiddleware<AppBindings>(async (context, next) => {",
            "    const credentials = extractCredentials(context.req.raw.headers, securityMeta);",
            "    if (credentials === undefined) {",
            '      return context.json({ error: "Unauthorized" }, 401);',
            "    }",
            "",
            "    const principal = await authenticator.authenticate(credentials);",
            "    if (principal === null) {",
            '      return context.json({ error: "Unauthorized" }, 401);',
            "    }",
            "",
            '    context.set("principal", principal);',
            "    await next();",
            "  });",
            "}",
          ].join("\n"),
        ]
      : []),
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
      hasAuth
        ? "export function registerJsonRoutes(app: Hono<AppBindings>, controllers: HttpControllers, authenticator: Authenticator): void {"
        : "export function registerJsonRoutes(app: Hono, controllers: HttpControllers): void {",
      routeRegistrations,
      "}",
    ].join("\n"),
    [
      hasAuth
        ? "export function createHonoApp(useCases: HttpUseCases, authenticator: Authenticator): Hono<AppBindings> {"
        : "export function createHonoApp(useCases: HttpUseCases): Hono {",
      hasAuth ? "  const app = new Hono<AppBindings>();" : "  const app = new Hono();",
      hasAuth
        ? "  registerJsonRoutes(app, createHttpControllers(useCases, authenticator), authenticator);"
        : "  registerJsonRoutes(app, createHttpControllers(useCases));",
      "  app.onError((error, context) => {",
      ...(hasAuth
        ? [
            "    if (error instanceof AuthenticationError) {",
            '      return context.json({ error: "Unauthorized" }, 401);',
            "    }",
          ]
        : []),
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

function renderRouteRegistration(operation: HttpModel["operations"][number]): string {
  const requestExpression = operation.hasJsonRequestBody
    ? "await jsonRequest(context)"
    : "request(context)";
  const controllerArguments = operation.requiresAuth
    ? `${requestExpression}, context.var.principal`
    : requestExpression;

  if (!operation.requiresAuth || operation.authMiddlewareName === undefined) {
    return [
      `  app.${operation.method}("${operation.honoPath}", async (context) =>`,
      `    respond(await controllers.${operation.operationId}(${controllerArguments})),`,
      "  );",
    ].join("\n");
  }

  return [
    `  const ${operation.authMiddlewareName} = createAuthenticateMiddleware(authenticator, ${renderSecurityMeta(operation)});`,
    `  app.${operation.method}("${operation.honoPath}", ${operation.authMiddlewareName}, async (context) =>`,
    `    respond(await controllers.${operation.operationId}(${controllerArguments})),`,
    "  );",
  ].join("\n");
}

function renderSecurityMeta(operation: HttpModel["operations"][number]): string {
  const schemes = operation.authSchemes.map((scheme) => {
    if (scheme.type === "apiKey") {
      return `{ name: ${JSON.stringify(scheme.name)}, type: "apiKey", headerName: ${JSON.stringify(scheme.headerName)} }`;
    }

    return `{ name: ${JSON.stringify(scheme.name)}, type: "http", scheme: "bearer", headerName: ${JSON.stringify(scheme.headerName)} }`;
  });

  return `{ schemes: [${schemes.join(", ")}] }`;
}
