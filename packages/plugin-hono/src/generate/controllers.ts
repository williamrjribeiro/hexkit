import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import { CONTROLLERS_FILE_PATH, type HttpModel } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";
import type { HttpOperationBinding } from "../artifact.ts";

export function renderControllersFile(model: HttpModel): GeneratedFile {
  const imports: ImportDeclaration[] = [
    ...model.operations.map((operation) => ({
      from: relativeImportPath(CONTROLLERS_FILE_PATH, operation.useCaseFilePath),
      names: [operation.useCaseTypeName],
      typeOnly: true,
    })),
    ...model.operations.map((operation) => ({
      from: relativeImportPath(CONTROLLERS_FILE_PATH, operation.wrapperImportPath),
      names: [operation.wrapperName],
    })),
    ...model.operations
      .filter(
        (
          operation,
        ): operation is HttpOperationBinding & {
          responseMapName: string;
          responseMapImportPath: string;
        } =>
          operation.responseMapName !== undefined && operation.responseMapImportPath !== undefined,
      )
      .map((operation) => ({
        from: relativeImportPath(CONTROLLERS_FILE_PATH, operation.responseMapImportPath),
        names: [operation.responseMapName],
      })),
  ];

  const useCaseFields = model.operations
    .map((operation) => `  ${operation.operationId}: ${operation.useCaseTypeName};`)
    .join("\n");

  const controllerEntries = model.operations.map(renderControllerEntry).join(",\n");

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
    [
      "export function createHttpControllers(useCases: HttpUseCases) {",
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

function renderControllerEntry(operation: HttpOperationBinding): string {
  const lines = [
    `    ${operation.operationId}: ${operation.wrapperName}(async (request) => {`,
    ...renderValidation(operation),
    ...renderInvocation(operation),
    ...renderSuccess(operation),
    "    })",
  ];
  return lines.join("\n");
}

function renderValidation(operation: HttpOperationBinding): string[] {
  if (operation.hasJsonRequestBody) {
    return [
      "      if (!request.isValid || !request.value.body) {",
      '        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);',
      "      }",
    ];
  }

  return ["      if (!request.isValid) throw new RequestValidationError(request.kind);"];
}

function renderInvocation(operation: HttpOperationBinding): string[] {
  const args = operation.useCaseArgumentExpressions.join(", ");
  if (operation.hasJsonSuccessBody || operation.notFoundStatus !== undefined) {
    return [`      const result = await useCases.${operation.operationId}(${args});`];
  }

  return [`      await useCases.${operation.operationId}(${args});`];
}

function renderSuccess(operation: HttpOperationBinding): string[] {
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
