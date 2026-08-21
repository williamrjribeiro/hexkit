import type { ImportDeclaration } from "@hexkit/codegen";
import { compareText, renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { NextHttpModel, NextMethodBinding } from "../artifact.ts";
import { CONTROLLERS_FILE_PATH } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";

export function renderControllersFile(model: NextHttpModel): GeneratedFile {
  const operations = model.routes
    .flatMap((route) => route.methods)
    .toSorted((left, right) => compareText(left.operationId, right.operationId));
  const hasAuth = model.authenticator !== undefined;
  const imports: ImportDeclaration[] = [
    ...operations.map((operation) => ({
      from: relativeImportPath(CONTROLLERS_FILE_PATH, operation.useCaseFilePath),
      names: [operation.useCaseTypeName],
      typeOnly: true,
    })),
    ...operations.map((operation) => ({
      from: relativeImportPath(CONTROLLERS_FILE_PATH, operation.wrapperImportPath),
      names: [operation.wrapperName],
    })),
    ...operations
      .filter(
        (
          operation,
        ): operation is NextMethodBinding & {
          responseMapName: string;
          responseMapImportPath: string;
        } =>
          operation.responseMapName !== undefined && operation.responseMapImportPath !== undefined,
      )
      .map((operation) => ({
        from: relativeImportPath(CONTROLLERS_FILE_PATH, operation.responseMapImportPath),
        names: [operation.responseMapName],
      })),
    ...(hasAuth
      ? [
          {
            from: relativeImportPath(CONTROLLERS_FILE_PATH, "src/core/domain/auth-principal.ts"),
            names: ["Principal"],
            typeOnly: true,
          },
          {
            from: relativeImportPath(CONTROLLERS_FILE_PATH, "src/core/ports/authenticator.ts"),
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
    ...(hasAuth
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
      hasAuth
        ? "export function createHttpControllers(useCases: HttpUseCases, authenticator?: Authenticator) {"
        : "export function createHttpControllers(useCases: HttpUseCases) {",
      ...(hasAuth
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
    path: CONTROLLERS_FILE_PATH,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}

function renderControllerEntry(operation: NextMethodBinding): string {
  if (operation.requiresPrincipal) return renderSecuredControllerEntry(operation);

  const lines = [
    `    ${operation.operationId}: ${operation.wrapperName}(async (request) => {`,
    ...renderValidation(operation),
    ...renderInvocation(operation),
    ...renderSuccess(operation),
    "    })",
  ];
  return lines.join("\n");
}

function renderSecuredControllerEntry(operation: NextMethodBinding): string {
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

function renderValidation(operation: NextMethodBinding): string[] {
  if (operation.hasJsonBody) {
    return [
      "      if (!request.isValid || !request.value.body) {",
      ...renderAuthenticationValidation(operation),
      '        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);',
      "      }",
    ];
  }

  if (!operation.requiresPrincipal) {
    return ["      if (!request.isValid) throw new RequestValidationError(request.kind);"];
  }

  return [
    "      if (!request.isValid) {",
    ...renderAuthenticationValidation(operation),
    "        throw new RequestValidationError(request.kind);",
    "      }",
  ];
}

function renderAuthenticationValidation(operation: NextMethodBinding): string[] {
  if (!operation.requiresPrincipal) return [];

  return [
    '        if (!request.isValid && request.kind === "headers-error") {',
    "          throw new AuthenticationError(request.kind);",
    "        }",
  ];
}

function renderInvocation(operation: NextMethodBinding): string[] {
  const args = operation.useCaseArgumentExpressions.join(", ");
  if (operation.hasJsonSuccessBody || operation.notFoundStatus !== undefined) {
    return [`      const result = await useCases.${operation.operationId}(${args});`];
  }

  return [`      await useCases.${operation.operationId}(${args});`];
}

function renderSuccess(operation: NextMethodBinding): string[] {
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
