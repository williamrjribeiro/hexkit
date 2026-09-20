import { renderSecurityMetaLiteral } from "@hexkit/shared";

import type { HttpOperationBinding } from "../../artifact.ts";

export function renderRouteRegistration(operation: HttpOperationBinding): string {
  const arrayKeysLiteral = JSON.stringify(operation.arrayQueryParameterNames);
  const requestExpression = operation.hasBinaryRequestBody
    ? `await binaryRequest(context, ${renderBinaryContentTypes(operation)}, ${arrayKeysLiteral})`
    : operation.hasJsonRequestBody
      ? `await jsonRequest(context, ${arrayKeysLiteral})`
      : `request(context, ${arrayKeysLiteral})`;
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

function renderBinaryContentTypes(operation: HttpOperationBinding): string {
  if (operation.requestBodyTransport.kind !== "binary") {
    throw new Error(
      `Binary operation "${operation.operationId}" is missing declared request content types.`,
    );
  }
  return JSON.stringify(operation.requestBodyTransport.contentTypes);
}

export function renderSecurityMeta(operation: HttpOperationBinding): string {
  return renderSecurityMetaLiteral(operation.authSchemes);
}
