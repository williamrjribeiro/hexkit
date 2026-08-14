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
  const hasAuth = route.methods.some((method) => method.requiresPrincipal);

  return [
    'import type { NextRequest } from "next/server";',
    ...(hasAuth ? ['import { AuthenticationError } from "@/adapters/http-next/controllers";'] : []),
    'import { getRuntime } from "@/adapters/http-next/runtime";',
    "import {",
    ...(hasAuth ? ["  extractCredentials,"] : []),
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
  const controllerArguments = method.requiresPrincipal
    ? "apicalRequest, principal"
    : "apicalRequest";

  return [
    `export async function ${methodName}(`,
    "  request: NextRequest,",
    "  ctx: { params: Promise<Record<string, string>> },",
    ") {",
    "  const params = await ctx.params;",
    "  const runtime = getRuntime();",
    "  try {",
    `    const apicalRequest = await toApicalRequest(request, params, { jsonBody: ${jsonBody} });`,
    ...renderAuthentication(method),
    `    const result = await runtime.controllers.${method.operationId}(${controllerArguments});`,
    "    return handleControllerResult(result);",
    "  } catch (error) {",
    "    return handleControllerError(error);",
    "  }",
    "}",
  ].join("\n");
}

function renderAuthentication(method: NextMethodBinding): string[] {
  if (!method.requiresPrincipal) return [];

  return [
    `    const credentials = extractCredentials(request.headers, ${renderSecurityMeta(method)});`,
    "    if (credentials === undefined) {",
    '      throw new AuthenticationError("credentials-missing");',
    "    }",
    "    const principal = await runtime.authenticator.authenticate(credentials);",
    "    if (principal === null) {",
    '      throw new AuthenticationError("principal-missing");',
    "    }",
  ];
}

function renderSecurityMeta(method: NextMethodBinding): string {
  const schemes = method.authSchemes.map((scheme) => {
    if (scheme.type === "apiKey") {
      return `{ name: ${JSON.stringify(scheme.name)}, type: "apiKey", headerName: ${JSON.stringify(scheme.headerName)} }`;
    }

    return `{ name: ${JSON.stringify(scheme.name)}, type: "http", scheme: "bearer", headerName: ${JSON.stringify(scheme.headerName)} }`;
  });

  return `{ schemes: [${schemes.join(", ")}] }`;
}
