import { describe, expect, it } from "vite-plus/test";

import type { ContractOperation } from "@hexkit/plugin-apical";

import { deriveHttpControllerBinding, type HttpUseCaseBindingInput } from "./controller-binding.ts";
import type { ContractSecurityScheme } from "./media.ts";

const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;
const stringType = { kind: "string", nullable: false } as const;

const publicSecurity = {
  overridesGlobal: true,
  requirements: [] as const,
  apicalServerHeaderNames: [] as const,
};

function operation(
  overrides: Partial<ContractOperation> & Pick<ContractOperation, "operationId">,
): ContractOperation {
  return {
    method: "get",
    path: "/items/{itemId}",
    modulePath: `routes/${overrides.operationId}.ts`,
    parameters: [{ name: "itemId", location: "path", required: true, type: stringType }],
    responses: [
      {
        status: "200",
        description: "ok",
        media: [{ mediaType: "application/json", type: itemReference }],
      },
    ],
    security: publicSecurity,
    ...overrides,
  };
}

function useCase(
  overrides: Partial<HttpUseCaseBindingInput> & Pick<HttpUseCaseBindingInput, "typeName">,
): HttpUseCaseBindingInput {
  return {
    factoryName: `create${overrides.typeName}`,
    filePath: "src/core/use-cases/get-item.ts",
    repositoryParameterName: "itemRepository",
    requiresAuth: false,
    parameters: [{ name: "itemId" }],
    ...overrides,
  };
}

const apiKeyScheme: ContractSecurityScheme = {
  name: "api_key",
  type: "apiKey",
  in: "header",
  headerName: "X-API-Key",
};

describe("Given deriveHttpControllerBinding", () => {
  it("when a public GET has JSON success, then wrapper paths and arguments are complete", () => {
    const binding = deriveHttpControllerBinding(
      operation({ operationId: "getItem" }),
      useCase({ typeName: "GetItem" }),
      [],
    );

    expect(binding).toMatchObject({
      operationId: "getItem",
      method: "get",
      openApiPath: "/items/{itemId}",
      useCaseTypeName: "GetItem",
      useCaseFactoryName: "createGetItem",
      wrapperName: "getItemWrapper",
      wrapperImportPath: "src/generated/contracts/server/getItem.ts",
      responseMapName: "getItemResponseMap",
      responseMapImportPath: "src/generated/contracts/routes/getItem.ts",
      successStatus: "200",
      hasJsonRequestBody: false,
      hasJsonSuccessBody: true,
      successMediaType: "application/json",
      requiresAuth: false,
      useCaseArgumentExpressions: ["request.value.path.itemId"],
    });
    expect(binding.notFoundStatus).toBeUndefined();
    expect(binding.authSchemes).toEqual([]);
  });

  it("when a JSON body operation is authenticated and can 404, then statuses and principal are set", () => {
    const binding = deriveHttpControllerBinding(
      operation({
        operationId: "updateItem",
        method: "put",
        requestBody: {
          required: true,
          media: [{ mediaType: "application/json", type: itemReference }],
        },
        responses: [
          {
            status: "200",
            description: "ok",
            media: [{ mediaType: "application/json", type: itemReference }],
          },
          { status: "404", description: "missing", media: [] },
        ],
        security: {
          overridesGlobal: true,
          requirements: [{ schemes: ["api_key"], scopes: {} }],
          apicalServerHeaderNames: ["X-API-Key"],
        },
      }),
      useCase({ typeName: "UpdateItem", requiresAuth: true, parameters: [{ name: "itemId" }] }),
      [apiKeyScheme],
    );

    expect(binding).toMatchObject({
      hasJsonRequestBody: true,
      notFoundStatus: "404",
      requiresAuth: true,
      useCaseArgumentExpressions: ["principal", "request.value.body"],
      authSchemes: [{ name: "api_key", type: "apiKey", headerName: "X-API-Key" }],
    });
  });

  it("when no 2xx response exists, then derivation throws", () => {
    expect(() =>
      deriveHttpControllerBinding(
        operation({
          operationId: "missing",
          responses: [{ status: "404", description: "missing", media: [] }],
        }),
        useCase({ typeName: "Missing" }),
        [],
      ),
    ).toThrow(/has no 2xx response for HTTP adapter generation/);
  });

  it("when success media is not JSON, then no response map is bound", () => {
    const binding = deriveHttpControllerBinding(
      operation({
        operationId: "deleteItem",
        method: "delete",
        responses: [{ status: "204", description: "gone", media: [] }],
      }),
      useCase({ typeName: "DeleteItem", parameters: [{ name: "itemId" }] }),
      [],
    );

    expect(binding.hasJsonSuccessBody).toBe(false);
    expect(binding.responseMapName).toBeUndefined();
    expect(binding.successMediaType).toBeUndefined();
    expect(binding.successStatus).toBe("204");
  });
});
