export function renderStaticRuntimeStatements(options: { hasAuth: boolean }): string[] {
  const contextType = options.hasAuth ? "AppContext" : "Context";

  return [
    ...(options.hasAuth ? renderAppBindingTypes() : []),
    renderApicalRequestType(),
    renderToApicalHeaders(),
    renderToApicalQuery(),
    renderRequestHelper(contextType),
    renderJsonRequestHelper(contextType),
    ...(options.hasAuth
      ? [
          renderSecuritySchemeMetaType(),
          renderOperationSecurityMetaType(),
          renderExtractCredentials(),
          renderCreateAuthenticateMiddleware(),
        ]
      : []),
    renderRespond(),
  ];
}

export function renderOnErrorHandler(options: { hasAuth: boolean }): string {
  return [
    "  app.onError((error, context) => {",
    ...(options.hasAuth
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
  ].join("\n");
}

function renderAppBindingTypes(): string[] {
  return [
    "type AppVariables = { principal: Principal };",
    "type AppBindings = { Variables: AppVariables };",
    "type AppContext = Context<AppBindings>;",
  ];
}

function renderApicalRequestType(): string {
  return [
    "type ApicalRequest = {",
    "  query: unknown;",
    "  path: unknown;",
    "  headers: unknown;",
    "  body?: unknown;",
    '  contentType?: "application/json";',
    "};",
  ].join("\n");
}

function renderToApicalHeaders(): string {
  return [
    "function toApicalHeaders(headers: Headers): Record<string, string> {",
    "  const result: Record<string, string> = {};",
    "  headers.forEach((value, key) => {",
    "    result[key.toLowerCase()] = value;",
    "  });",
    "  return result;",
    "}",
  ].join("\n");
}

function renderToApicalQuery(): string {
  return [
    "function toApicalQuery(",
    "  queries: Record<string, string[]>,",
    "  arrayQueryKeys: readonly string[],",
    "): Record<string, string | string[]> {",
    "  const arrayKeySet = new Set(arrayQueryKeys);",
    "  const query: Record<string, string | string[]> = {};",
    "  for (const [key, values] of Object.entries(queries)) {",
    "    if (arrayKeySet.has(key)) {",
    "      query[key] = values;",
    "    } else if (values[0] !== undefined) {",
    "      query[key] = values[0];",
    "    }",
    "  }",
    "  return query;",
    "}",
  ].join("\n");
}

function renderRequestHelper(contextType: string): string {
  return [
    `function request(context: ${contextType}, arrayQueryKeys: readonly string[] = []): ApicalRequest {`,
    "  return {",
    "    query: toApicalQuery(context.req.queries(), arrayQueryKeys),",
    "    path: context.req.param(),",
    "    headers: toApicalHeaders(context.req.raw.headers),",
    "  };",
    "}",
  ].join("\n");
}

function renderJsonRequestHelper(contextType: string): string {
  return [
    `async function jsonRequest(context: ${contextType}, arrayQueryKeys: readonly string[] = []): Promise<ApicalRequest> {`,
    '  const contentType = context.req.header("content-type")?.split(";", 1)[0]?.trim();',
    '  if (contentType !== "application/json") {',
    '    throw new RequestValidationError("body-error");',
    "  }",
    "",
    "  try {",
    "    return {",
    "      ...request(context, arrayQueryKeys),",
    "      body: await context.req.json(),",
    '      contentType: "application/json",',
    "    };",
    "  } catch {",
    '    throw new RequestValidationError("body-error");',
    "  }",
    "}",
  ].join("\n");
}

function renderSecuritySchemeMetaType(): string {
  return [
    "type SecuritySchemeMeta =",
    '  | { name: string; type: "apiKey"; headerName: string }',
    '  | { name: string; type: "http"; scheme: "bearer"; headerName: "Authorization" };',
  ].join("\n");
}

function renderOperationSecurityMetaType(): string {
  return ["type OperationSecurityMeta = {", "  schemes: readonly SecuritySchemeMeta[];", "};"].join(
    "\n",
  );
}

function renderExtractCredentials(): string {
  return [
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
  ].join("\n");
}

function renderCreateAuthenticateMiddleware(): string {
  return [
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
  ].join("\n");
}

function renderRespond(): string {
  return [
    "function respond(result: {",
    "  status: string;",
    '  contentType?: "application/json";',
    "  data?: unknown;",
    "  headers?: Record<string, string | number | boolean>;",
    "}): Response {",
    "  const status = Number(result.status);",
    "  const headers: Record<string, string> = {};",
    "  for (const [name, value] of Object.entries(result.headers ?? {})) {",
    "    headers[name] = String(value);",
    "  }",
    "  if (result.data === undefined) return new Response(null, { status, headers });",
    '  headers["content-type"] = result.contentType ?? "application/json";',
    "  return new Response(JSON.stringify(result.data), {",
    "    status,",
    "    headers,",
    "  });",
    "}",
  ].join("\n");
}
