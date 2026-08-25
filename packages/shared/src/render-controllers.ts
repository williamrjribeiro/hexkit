import type { ImportDeclaration } from "@hexkit/codegen";
import { compareText, relativeImportPath, renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { HttpControllerOperation } from "./controller-binding.ts";

/**
 * Emit the shared Apical HTTP controller module used by Hono and Next adapters.
 *
 * @param options.filePath - Generated file path (Hono and Next use different adapter folders).
 * @param options.operations - Controller bindings; sorted by `operationId` for stable output.
 * @param options.hasAuthenticator - When true, emit `AuthenticationError` and principal wiring.
 */
export function renderHttpControllersFile(options: {
  filePath: string;
  operations: readonly HttpControllerOperation[];
  hasAuthenticator: boolean;
}): GeneratedFile {
  const operations = options.operations.toSorted((left, right) =>
    compareText(left.operationId, right.operationId),
  );
  const hasAuthenticator = options.hasAuthenticator;
  const imports: ImportDeclaration[] = [
    ...operations.map((operation) => ({
      from: relativeImportPath(options.filePath, operation.useCaseFilePath),
      names: [operation.useCaseTypeName],
      typeOnly: true,
    })),
    ...operations.map((operation) => ({
      from: relativeImportPath(options.filePath, operation.wrapperImportPath),
      names: [operation.wrapperName],
    })),
    ...operations
      .filter(
        (
          operation,
        ): operation is HttpControllerOperation & {
          responseMapName: string;
          responseMapImportPath: string;
        } =>
          operation.responseMapName !== undefined && operation.responseMapImportPath !== undefined,
      )
      .map((operation) => ({
        from: relativeImportPath(options.filePath, operation.responseMapImportPath),
        names: [operation.responseMapName],
      })),
    ...(hasAuthenticator
      ? [
          {
            from: relativeImportPath(options.filePath, "src/core/domain/auth-principal.ts"),
            names: ["Principal"],
            typeOnly: true,
          },
          {
            from: relativeImportPath(options.filePath, "src/core/ports/authenticator.ts"),
            names: ["Authenticator"],
            typeOnly: true,
          },
        ]
      : []),
  ];

  const useCaseFields = operations
    .map((operation) => `  ${operation.operationId}: ${operation.useCaseTypeName};`)
    .join("\n");

  const controllerEntries = operations.map(renderControllerEntry).join(",\n");

  const statements = [
    ["export type HttpUseCases = {", useCaseFields, "};"].join("\n"),
    [
      "export class RequestValidationError extends Error {",
      "  constructor(kind: string) {",
      "    super(`Invalid HTTP request: ${kind}`);",
      '    this.name = "RequestValidationError";',
      "  }",
      "}",
    ].join("\n"),
    ...(hasAuthenticator
      ? [
          "type ControllerRequest<TController> = TController extends (request: infer Request) => Promise<unknown> ? Request : never;",
          [
            "export class AuthenticationError extends Error {",
            "  constructor(kind: string) {",
            "    super(`Authentication failed: ${kind}`);",
            '    this.name = "AuthenticationError";',
            "  }",
            "}",
          ].join("\n"),
        ]
      : []),
    [
      hasAuthenticator
        ? "export function createHttpControllers(useCases: HttpUseCases, authenticator?: Authenticator) {"
        : "export function createHttpControllers(useCases: HttpUseCases) {",
      ...(hasAuthenticator
        ? [
            "  if (authenticator === undefined) {",
            '    throw new AuthenticationError("authenticator-missing");',
            "  }",
          ]
        : []),
      "  return {",
      controllerEntries,
      "  };",
      "}",
    ].join("\n"),
    "export type HttpControllers = ReturnType<typeof createHttpControllers>;",
  ];

  return {
    path: options.filePath,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}

function renderControllerEntry(operation: HttpControllerOperation): string {
  if (operation.requiresAuth) return renderSecuredControllerEntry(operation);

  const lines = [
    `    ${operation.operationId}: ${operation.wrapperName}(async (request) => {`,
    ...renderValidation(operation),
    ...renderInvocation(operation),
    ...renderSuccess(operation),
    "    })",
  ];
  return lines.join("\n");
}

function renderSecuredControllerEntry(operation: HttpControllerOperation): string {
  const lines = [
    `    ${operation.operationId}: async (`,
    `      request: ControllerRequest<ReturnType<typeof ${operation.wrapperName}>>,`,
    "      principal: Principal,",
    `    ) => ${operation.wrapperName}(async (request) => {`,
    ...renderValidation(operation),
    ...renderInvocation(operation),
    ...renderSuccess(operation),
    "    })(request)",
  ];
  return lines.join("\n");
}

function renderValidation(operation: HttpControllerOperation): string[] {
  if (operation.hasJsonRequestBody) {
    return [
      "      if (!request.isValid || !request.value.body) {",
      ...renderAuthenticationValidation(operation),
      '        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);',
      "      }",
    ];
  }

  if (!operation.requiresAuth) {
    return ["      if (!request.isValid) throw new RequestValidationError(request.kind);"];
  }

  return [
    "      if (!request.isValid) {",
    ...renderAuthenticationValidation(operation),
    "        throw new RequestValidationError(request.kind);",
    "      }",
  ];
}

function renderAuthenticationValidation(operation: HttpControllerOperation): string[] {
  if (!operation.requiresAuth) return [];

  return [
    '        if (!request.isValid && request.kind === "headers-error") {',
    "          throw new AuthenticationError(request.kind);",
    "        }",
  ];
}

function renderInvocation(operation: HttpControllerOperation): string[] {
  const args = operation.useCaseArgumentExpressions.join(", ");
  if (operation.hasJsonSuccessBody || operation.notFoundStatus !== undefined) {
    return [`      const result = await useCases.${operation.operationId}(${args});`];
  }

  return [`      await useCases.${operation.operationId}(${args});`];
}

function renderSuccess(operation: HttpControllerOperation): string[] {
  const lines: string[] = [];

  if (operation.notFoundStatus !== undefined) {
    lines.push(`      if (!result) return { status: "${operation.notFoundStatus}" };`);
  }

  if (!operation.hasJsonSuccessBody || operation.responseMapName === undefined) {
    lines.push(`      return { status: "${operation.successStatus}" };`);
    return lines;
  }

  const mediaType = operation.successMediaType ?? "application/json";
  lines.push("      return {");
  lines.push(`        status: "${operation.successStatus}",`);
  lines.push(`        contentType: "${mediaType}",`);
  lines.push(
    `        data: ${operation.responseMapName}["${operation.successStatus}"]["${mediaType}"].parse(result),`,
  );
  lines.push("      };");
  return lines;
}
