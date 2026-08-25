import { renderSecurityMetaLiteral } from "@hexkit/shared";

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
  return renderSecurityMetaLiteral(operation.authSchemes);
}
