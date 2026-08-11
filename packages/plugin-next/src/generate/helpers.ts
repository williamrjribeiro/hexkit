import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import { HELPERS_FILE_PATH } from "../model/derive.ts";

export function renderHelpersFile(): GeneratedFile {
  const imports: ImportDeclaration[] = [
    {
      from: "next/server",
      names: ["NextRequest"],
      typeOnly: true,
    },
    {
      from: "./controllers.ts",
      names: ["AuthenticationError", "RequestValidationError"],
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
    [
      "export async function toApicalRequest(",
      "  request: NextRequest,",
      "  params: Record<string, string>,",
      "  options: { jsonBody: boolean },",
      "): Promise<ApicalRequest> {",
      "  const query = Object.fromEntries(request.nextUrl.searchParams.entries());",
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
      "  if (error instanceof AuthenticationError) {",
      '    return Response.json({ error: "Unauthorized" }, { status: 401 });',
      "  }",
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
