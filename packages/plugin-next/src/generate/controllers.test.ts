import { describe, expect, it } from "vite-plus/test";

import type { NextHttpModel, NextMethodBinding } from "../artifact.ts";
import { renderControllersFile } from "./controllers.ts";

function binding(
  overrides: Partial<NextMethodBinding> & Pick<NextMethodBinding, "operationId">,
): NextMethodBinding {
  return {
    method: "get",
    openApiPath: "/items",
    useCaseTypeName: `${overrides.operationId}UseCase`,
    useCaseFactoryName: `create${overrides.operationId}UseCase`,
    useCaseFilePath: `src/core/use-cases/${overrides.operationId}.ts`,
    repositoryParameterName: "itemRepository",
    wrapperName: `${overrides.operationId}Wrapper`,
    wrapperImportPath: `src/generated/contracts/server/${overrides.operationId}.ts`,
    hasJsonRequestBody: false,
    hasJsonSuccessBody: true,
    successStatus: "200",
    successMediaType: "application/json",
    requiresAuth: false,
    authSchemes: [],
    useCaseArgumentExpressions: [],
    ...overrides,
  };
}

function model(overrides: Partial<NextHttpModel> = {}): NextHttpModel {
  return {
    surface: "routes",
    routes: [
      {
        filePath: "app/items/route.ts",
        openApiPath: "/items",
        methods: [binding({ operationId: "getItem" })],
      },
    ],
    uiPages: [],
    repositories: [],
    ...overrides,
  };
}

describe("Given renderControllersFile", () => {
  it("when given a complete HTTP model, then it emits wrappers from bindings without contract lookup", () => {
    const file = renderControllersFile(
      model({
        routes: [
          {
            filePath: "app/items/route.ts",
            openApiPath: "/items",
            methods: [
              binding({
                operationId: "getItem",
                responseMapName: "getItemResponseMap",
                responseMapImportPath: "src/generated/contracts/routes/getItem.ts",
                useCaseArgumentExpressions: ["request.value.path.itemId"],
              }),
            ],
          },
        ],
      }),
    );

    expect(file.path).toBe("src/adapters/http-next/controllers.ts");
    expect(file.contents).toContain("getItemWrapper");
    expect(file.contents).toContain('status: "200"');
    expect(file.contents).toContain(
      'data: getItemResponseMap["200"]["application/json"].parse(result),',
    );
    expect(file.contents).not.toContain("authenticator");
  });

  it("when a binding has no JSON success body, then the controller returns status only", () => {
    const file = renderControllersFile(
      model({
        routes: [
          {
            filePath: "app/items/route.ts",
            openApiPath: "/items",
            methods: [
              binding({
                operationId: "deleteItem",
                method: "delete",
                hasJsonSuccessBody: false,
                successStatus: "204",
                successMediaType: undefined,
                notFoundStatus: "404",
              }),
            ],
          },
        ],
      }),
    );

    expect(file.contents).toContain('if (!result) return { status: "404" };');
    expect(file.contents).toContain('return { status: "204" };');
    expect(file.contents).not.toContain("ResponseMap");
  });

  it("when a JSON body operation requires a principal, then validation and invocation use the binding", () => {
    const file = renderControllersFile(
      model({
        authenticator: {
          portFilePath: "src/core/ports/authenticator.ts",
          adapterFilePath: "src/adapters/auth/in-memory-authenticator.ts",
          adapterFactoryName: "createInMemoryAuthenticator",
        },
        routes: [
          {
            filePath: "app/items/route.ts",
            openApiPath: "/items",
            methods: [
              binding({
                operationId: "createItem",
                method: "post",
                hasJsonRequestBody: true,
                requiresAuth: true,
                useCaseArgumentExpressions: ["principal", "request.value.body"],
                responseMapName: "createItemResponseMap",
                responseMapImportPath: "src/generated/contracts/routes/createItem.ts",
                successStatus: "201",
              }),
            ],
          },
        ],
      }),
    );

    expect(file.contents).toContain("principal: Principal");
    expect(file.contents).toContain('throw new AuthenticationError("authenticator-missing")');
    expect(file.contents).toContain(
      'throw new RequestValidationError(request.isValid ? "body-error" : request.kind);',
    );
    expect(file.contents).toContain("await useCases.createItem(principal, request.value.body)");
  });

  it("when a secured operation has no JSON body, then header errors become AuthenticationError", () => {
    const file = renderControllersFile(
      model({
        authenticator: {
          portFilePath: "src/core/ports/authenticator.ts",
          adapterFilePath: "src/adapters/auth/in-memory-authenticator.ts",
          adapterFactoryName: "createInMemoryAuthenticator",
        },
        routes: [
          {
            filePath: "app/items/route.ts",
            openApiPath: "/items",
            methods: [
              binding({
                operationId: "getItem",
                requiresAuth: true,
                hasJsonSuccessBody: false,
                successMediaType: undefined,
                useCaseArgumentExpressions: ["principal", "request.value.path.itemId"],
              }),
            ],
          },
        ],
      }),
    );

    expect(file.contents).toContain('if (!request.isValid && request.kind === "headers-error") {');
    expect(file.contents).toContain("await useCases.getItem(principal, request.value.path.itemId)");
    expect(file.contents).not.toContain("const result = await");
  });

  it("when a JSON body operation is unsecured, then body validation does not mention authentication", () => {
    const file = renderControllersFile(
      model({
        routes: [
          {
            filePath: "app/items/route.ts",
            openApiPath: "/items",
            methods: [
              binding({
                operationId: "createItem",
                method: "post",
                hasJsonRequestBody: true,
                useCaseArgumentExpressions: ["request.value.body"],
                responseMapName: "createItemResponseMap",
                responseMapImportPath: "src/generated/contracts/routes/createItem.ts",
                successStatus: "201",
                successMediaType: undefined,
              }),
            ],
          },
        ],
      }),
    );

    expect(file.contents).toContain("if (!request.isValid || !request.value.body)");
    expect(file.contents).not.toContain("AuthenticationError");
    expect(file.contents).toContain('contentType: "application/json"');
  });
});
