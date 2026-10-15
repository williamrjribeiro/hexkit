import { renderSecurityMetaLiteral } from "@hexkit/shared";

import type { HttpOperationBinding } from "../../artifact.ts";

export function renderRouteRegistration(operation: HttpOperationBinding): string {
  const arrayKeysLiteral = JSON.stringify(operation.arrayQueryParameterNames);
  const requestExpression = operation.hasBinaryRequestBody
    ? `await binaryRequest(context, ${renderBinaryContentTypes(operation)}, ${arrayKeysLiteral})`
    : operation.requestBodyTransport.kind === "json" &&
        operation.requestBodyTransport.xmlContentTypes !== undefined
      ? `await typedRequest(context, ${renderJsonContentTypes(operation)}, ${renderXmlContentTypes(operation)}, ${arrayKeysLiteral})`
      : operation.requestBodyTransport.kind === "xml"
        ? `await xmlRequest(context, ${renderXmlContentTypes(operation)}, ${arrayKeysLiteral})`
        : operation.hasJsonRequestBody
          ? `await jsonRequest(context, ${arrayKeysLiteral})`
          : `request(context, ${arrayKeysLiteral})`;
  const controllerArguments = operation.requiresAuth
    ? `${requestExpression}, context.var.principal`
    : requestExpression;

  if (!operation.requiresAuth || operation.authMiddlewareName === undefined) {
    return [
      `  app.${operation.method}("${operation.honoPath}", async (context) =>`,
      `    respond(await controllers.${operation.operationId}(${controllerArguments}), context.req.header("accept")),`,
      "  );",
    ].join("\n");
  }

  return [
    `  const ${operation.authMiddlewareName} = createAuthenticateMiddleware(authenticator, ${renderSecurityMeta(operation)});`,
    `  app.${operation.method}("${operation.honoPath}", ${operation.authMiddlewareName}, async (context) =>`,
    `    respond(await controllers.${operation.operationId}(${controllerArguments}), context.req.header("accept")),`,
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

function renderJsonContentTypes(operation: HttpOperationBinding): string {
  if (operation.requestBodyTransport.kind !== "json") {
    throw new Error(
      `Typed operation "${operation.operationId}" is missing declared JSON content types.`,
    );
  }
  return JSON.stringify(operation.requestBodyTransport.contentTypes);
}

function renderXmlContentTypes(operation: HttpOperationBinding): string {
  const transport = operation.requestBodyTransport;
  if (transport.kind === "xml") {
    return JSON.stringify(transport.contentTypes);
  }
  if (transport.kind === "json" && transport.xmlContentTypes !== undefined) {
    return JSON.stringify(transport.xmlContentTypes);
  }
  throw new Error(
    `XML operation "${operation.operationId}" is missing declared XML content types.`,
  );
}

export function renderSecurityMeta(operation: HttpOperationBinding): string {
  return renderSecurityMetaLiteral(operation.authSchemes);
}
