import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { NextHttpModel } from "../artifact.ts";
import { HELPERS_FILE_PATH } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";

export function renderHelpersFile(model: NextHttpModel): GeneratedFile {
  const hasAuth = model.authenticator !== undefined;
  const imports: ImportDeclaration[] = [
    ...(hasAuth
      ? [
          {
            from: relativeImportPath(HELPERS_FILE_PATH, "src/core/ports/authenticator.ts"),
            names: ["AuthCredentials"],
            typeOnly: true,
          },
        ]
      : []),
    {
      from: "next/server",
      names: ["NextRequest"],
      typeOnly: true,
    },
    {
      from: "./controllers.ts",
      names: [...(hasAuth ? ["AuthenticationError"] : []), "RequestValidationError"],
    },
  ];

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
      "function toApicalHeaders(headers: Headers): Record<string, string> {",
      "  const result: Record<string, string> = {};",
      "  headers.forEach((value, key) => {",
      "    result[key.toLowerCase()] = value;",
      "  });",
      "  return result;",
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
            "export function extractCredentials(",
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
        ]
      : []),
    [
      "function parseApicalQuery(",
      "  searchParams: URLSearchParams,",
      "  arrayQueryKeys: readonly string[],",
      "): Record<string, string | string[]> {",
      "  const arrayKeySet = new Set(arrayQueryKeys);",
      "  const query: Record<string, string | string[]> = {};",
      "  for (const key of new Set(searchParams.keys())) {",
      "    const values = searchParams.getAll(key);",
      "    if (arrayKeySet.has(key)) {",
      "      query[key] = values;",
      "    } else if (values[0] !== undefined) {",
      "      query[key] = values[0];",
      "    }",
      "  }",
      "  return query;",
      "}",
    ].join("\n"),
    [
      "export async function toApicalRequest(",
      "  request: NextRequest,",
      "  params: Record<string, string>,",
      "  options: { jsonBody: boolean; arrayQueryKeys?: readonly string[] },",
      "): Promise<ApicalRequest> {",
      "  const query = parseApicalQuery(request.nextUrl.searchParams, options.arrayQueryKeys ?? []);",
      "  const baseRequest: ApicalRequest = {",
      "    query,",
      "    path: params,",
      "    headers: toApicalHeaders(request.headers),",
      "  };",
      "",
      "  if (!options.jsonBody) return baseRequest;",
      "",
      '  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();',
      '  if (contentType !== "application/json") {',
      '    throw new RequestValidationError("body-error");',
      "  }",
      "",
      "  try {",
      "    return {",
      "      ...baseRequest,",
      "      body: await request.json(),",
      '      contentType: "application/json",',
      "    };",
      "  } catch {",
      '    throw new RequestValidationError("body-error");',
      "  }",
      "}",
    ].join("\n"),
    [
      "export function handleControllerResult(result: {",
      "  status: string;",
      '  contentType?: "application/json";',
      "  data?: unknown;",
      "}): Response {",
      "  const status = Number(result.status);",
      "  if (result.data === undefined) return new Response(null, { status });",
      "  return Response.json(result.data, {",
      "    status,",
      '    headers: { "content-type": result.contentType ?? "application/json" },',
      "  });",
      "}",
    ].join("\n"),
    [
      "export function handleControllerError(error: unknown): Response {",
      ...(hasAuth
        ? [
            "  if (error instanceof AuthenticationError) {",
            '    return Response.json({ error: "Unauthorized" }, { status: 401 });',
            "  }",
          ]
        : []),
      "  if (error instanceof RequestValidationError) {",
      '    return Response.json({ error: "Bad Request" }, { status: 400 });',
      "  }",
      '  return Response.json({ error: "Internal Server Error" }, { status: 500 });',
      "}",
    ].join("\n"),
  ];

  return {
    path: HELPERS_FILE_PATH,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}
