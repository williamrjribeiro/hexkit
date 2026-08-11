import type { GeneratedFile } from "@hexkit/plugin-api";

import type { NextMethodBinding, NextRouteFile } from "../artifact.ts";

export function renderRouteFiles(routes: readonly NextRouteFile[]): GeneratedFile[] {
  return routes.map(renderRouteFile);
}

function renderRouteFile(route: NextRouteFile): GeneratedFile {
  return {
    path: route.filePath,
    contents: renderRouteSource(route),
    ownership: "generated",
  };
}

function renderRouteSource(route: NextRouteFile): string {
  return [
    'import type { NextRequest } from "next/server";',
    'import { getRuntime } from "@/adapters/http-next/runtime";',
    "import {",
    "  handleControllerError,",
    "  handleControllerResult,",
    "  toApicalRequest,",
    '} from "@/adapters/http-next/helpers";',
    "",
    route.methods.map(renderMethodHandler).join("\n\n"),
    "",
  ].join("\n");
}

function renderMethodHandler(method: NextMethodBinding): string {
  const methodName = method.method.toUpperCase();
  const jsonBody = method.hasJsonBody ? "true" : "false";

  return [
    `export async function ${methodName}(`,
    "  request: NextRequest,",
    "  ctx: { params: Promise<Record<string, string>> },",
    ") {",
    "  const params = await ctx.params;",
    "  const runtime = getRuntime();",
    "  try {",
    `    const apicalRequest = await toApicalRequest(request, params, { jsonBody: ${jsonBody} });`,
    `    const result = await runtime.controllers.${method.operationId}(apicalRequest);`,
    "    return handleControllerResult(result);",
    "  } catch (error) {",
    "    return handleControllerError(error);",
    "  }",
    "}",
  ].join("\n");
}
