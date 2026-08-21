import type { HttpOperationBinding } from "../../artifact.ts";

export function renderRouteRegistration(operation: HttpOperationBinding): string {
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

export function renderSecurityMeta(operation: HttpOperationBinding): string {
  const schemes = operation.authSchemes.map((scheme) => {
    if (scheme.type === "apiKey") {
      return `{ name: ${JSON.stringify(scheme.name)}, type: "apiKey", headerName: ${JSON.stringify(scheme.headerName)} }`;
    }

    return `{ name: ${JSON.stringify(scheme.name)}, type: "http", scheme: "bearer", headerName: ${JSON.stringify(scheme.headerName)} }`;
  });

  return `{ schemes: [${schemes.join(", ")}] }`;
}
