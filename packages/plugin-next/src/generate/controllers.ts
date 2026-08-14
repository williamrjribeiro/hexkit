import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";
import type {
  ApplicationArtifact,
  ApplicationUseCase,
} from "@hexkit/plugin-architecture-hexagonal";
import type {
  ContractArtifact,
  ContractHttpMethod,
  ContractMedia,
  ContractOperation,
  ContractResponse,
} from "@hexkit/plugin-apical";

import type { NextMethodBinding } from "../artifact.ts";
import type { NextHttpModel } from "../artifact.ts";
import { CONTROLLERS_FILE_PATH } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";

type ControllerOperation = NextMethodBinding & {
  useCaseFactoryName: string;
  repositoryParameterName: string;
  successStatus: string;
  notFoundStatus?: string;
  hasJsonSuccessBody: boolean;
  successMediaType?: string;
  useCaseArgumentExpressions: readonly string[];
};

export function renderControllersFile(
  model: NextHttpModel,
  contract: ContractArtifact,
  application: ApplicationArtifact,
): GeneratedFile {
  const operations = deriveControllerOperations(contract, application);
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
        ): operation is ControllerOperation & {
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

function deriveControllerOperations(
  contract: ContractArtifact,
  application: ApplicationArtifact,
): ControllerOperation[] {
  const useCasesByOperationId = new Map(
    application.useCases.map((useCase) => [useCase.operationId, useCase] as const),
  );

  return contract.operations
    .toSorted((left, right) => compareText(left.operationId, right.operationId))
    .map((operation) => {
      const useCase = useCasesByOperationId.get(operation.operationId);
      if (useCase === undefined) {
        throw new Error(
          `ApplicationArtifact is missing use case for operation "${operation.operationId}".`,
        );
      }
      return deriveControllerOperation(operation, useCase);
    });
}

function deriveControllerOperation(
  operation: ContractOperation,
  useCase: ApplicationUseCase,
): ControllerOperation {
  const successResponse = findSuccessResponse(operation);
  if (successResponse === undefined) {
    throw new Error(
      `Operation "${operation.operationId}" has no 2xx response for HTTP adapter generation.`,
    );
  }

  const jsonSuccessMedia = findJsonMedia(successResponse.media);
  const hasJsonBody = Boolean(
    operation.requestBody?.media.some(
      (media) => media.mediaType === "application/json" && media.type !== undefined,
    ),
  );
  const hasNotFound = operation.responses.some((response) => response.status === "404");
  const responseMapName =
    jsonSuccessMedia === undefined ? undefined : `${operation.operationId}ResponseMap`;

  return {
    method: toNextMethod(operation.method),
    operationId: operation.operationId,
    useCaseTypeName: useCase.typeName,
    useCaseFactoryName: useCase.factoryName,
    useCaseFilePath: useCase.filePath,
    repositoryParameterName: useCase.repositoryParameterName,
    wrapperName: `${operation.operationId}Wrapper`,
    wrapperImportPath: `src/generated/contracts/server/${operation.operationId}.ts`,
    ...(responseMapName === undefined
      ? {}
      : {
          responseMapName,
          responseMapImportPath: `src/generated/contracts/${operation.modulePath}`,
        }),
    hasJsonBody,
    requiresPrincipal: useCase.requiresAuth,
    authSchemes: [],
    successStatus: successResponse.status,
    ...(hasNotFound ? { notFoundStatus: "404" } : {}),
    hasJsonSuccessBody: jsonSuccessMedia !== undefined,
    ...(jsonSuccessMedia === undefined ? {} : { successMediaType: jsonSuccessMedia.mediaType }),
    useCaseArgumentExpressions: deriveUseCaseArguments(useCase, hasJsonBody),
  };
}

function deriveUseCaseArguments(useCase: ApplicationUseCase, hasJsonBody: boolean): string[] {
  const principalExpression = useCase.requiresAuth ? ["principal"] : [];
  if (hasJsonBody) {
    return [...principalExpression, "request.value.body"];
  }

  return [
    ...principalExpression,
    ...useCase.parameters.map((parameter) => `request.value.path.${parameter.name}`),
  ];
}

function renderControllerEntry(operation: ControllerOperation): string {
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

function renderSecuredControllerEntry(operation: ControllerOperation): string {
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

function renderValidation(operation: ControllerOperation): string[] {
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

function renderAuthenticationValidation(operation: ControllerOperation): string[] {
  if (!operation.requiresPrincipal) return [];

  return [
    '        if (!request.isValid && request.kind === "headers-error") {',
    "          throw new AuthenticationError(request.kind);",
    "        }",
  ];
}

function renderInvocation(operation: ControllerOperation): string[] {
  const args = operation.useCaseArgumentExpressions.join(", ");
  if (operation.hasJsonSuccessBody || operation.notFoundStatus !== undefined) {
    return [`      const result = await useCases.${operation.operationId}(${args});`];
  }

  return [`      await useCases.${operation.operationId}(${args});`];
}

function renderSuccess(operation: ControllerOperation): string[] {
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

function findSuccessResponse(operation: ContractOperation): ContractResponse | undefined {
  return operation.responses.find((response) => isSuccessStatus(response.status));
}

function findJsonMedia(media: readonly ContractMedia[]): ContractMedia | undefined {
  return media.find((entry) => entry.mediaType === "application/json" && entry.type !== undefined);
}

function isSuccessStatus(status: string): boolean {
  return /^2\d\d$/.test(status);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toNextMethod(method: ContractHttpMethod): NextMethodBinding["method"] {
  if (method === "trace") {
    throw new Error(`HTTP method "trace" is not supported by the Next.js adapter.`);
  }
  return method;
}
