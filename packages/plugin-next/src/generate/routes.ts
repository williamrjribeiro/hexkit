import type { GeneratedFile } from "@hexkit/plugin-api";
import { renderSecurityMetaLiteral, usesXmlMedia } from "@hexkit/shared";

import type { NextMethodBinding, NextRouteFile } from "../artifact.ts";

export function renderRouteFiles(routes: readonly NextRouteFile[]): GeneratedFile[] {
  const hasXmlRuntime = routes.some((route) => route.methods.some(usesXmlMedia));
  return routes.map((route) => renderRouteFile(route, hasXmlRuntime));
}

function renderRouteFile(route: NextRouteFile, hasXmlRuntime: boolean): GeneratedFile {
  return {
    path: route.filePath,
    contents: renderRouteSource(route, hasXmlRuntime),
    ownership: "generated",
  };
}

function renderRouteSource(route: NextRouteFile, hasXmlRuntime: boolean): string {
  const hasAuth = route.methods.some((method) => method.requiresAuth);

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
    route.methods.map((method) => renderMethodHandler(method, hasXmlRuntime)).join("\n\n"),
    "",
  ].join("\n");
}

function renderMethodHandler(method: NextMethodBinding, hasXmlRuntime: boolean): string {
  const methodName = method.method.toUpperCase();
  const requestOptions = renderRequestOptions(method);
  const arrayKeysLiteral = JSON.stringify(method.arrayQueryParameterNames);
  const controllerArguments = method.requiresAuth ? "apicalRequest, principal" : "apicalRequest";

  return [
    `export async function ${methodName}(`,
    "  request: NextRequest,",
    "  ctx: { params: Promise<Record<string, string>> },",
    ") {",
    "  const params = await ctx.params;",
    "  const runtime = getRuntime();",
    "  try {",
    `    const apicalRequest = await toApicalRequest(request, params, { ${requestOptions} arrayQueryKeys: ${arrayKeysLiteral} });`,
    ...renderAuthentication(method),
    `    const result = await runtime.controllers.${method.operationId}(${controllerArguments});`,
    hasXmlRuntime
      ? '    return handleControllerResult(result, request.headers.get("accept"));'
      : "    return handleControllerResult(result);",
    "  } catch (error) {",
    "    return handleControllerError(error);",
    "  }",
    "}",
  ].join("\n");
}

function renderRequestOptions(method: NextMethodBinding): string {
  if (method.hasBinaryRequestBody) {
    return `jsonBody: false, binaryBody: true, contentTypes: ${renderBinaryContentTypes(method)},`;
  }
  const transport = method.requestBodyTransport;
  if (transport.kind === "xml") {
    return `jsonBody: false, xmlBody: true, contentTypes: ${JSON.stringify(transport.contentTypes)},`;
  }
  if (transport.kind === "json" && transport.xmlContentTypes !== undefined) {
    return `jsonBody: true, xmlContentTypes: ${JSON.stringify(transport.xmlContentTypes)},`;
  }
  return `jsonBody: ${method.hasJsonRequestBody ? "true" : "false"},`;
}

function renderBinaryContentTypes(method: NextMethodBinding): string {
  if (method.requestBodyTransport.kind !== "binary") {
    throw new Error(
      `Binary operation "${method.operationId}" is missing declared request content types.`,
    );
  }
  return JSON.stringify(method.requestBodyTransport.contentTypes);
}

function renderAuthentication(method: NextMethodBinding): string[] {
  if (!method.requiresAuth) return [];

  return [
    `    const credentials = extractCredentials(request.headers, ${renderSecurityMetaLiteral(method.authSchemes)});`,
    "    if (credentials === undefined) {",
    '      throw new AuthenticationError("credentials-missing");',
    "    }",
    "    const principal = await runtime.authenticator.authenticate(credentials);",
    "    if (principal === null) {",
    '      throw new AuthenticationError("principal-missing");',
    "    }",
  ];
}
