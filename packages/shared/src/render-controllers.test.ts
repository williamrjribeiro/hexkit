import { describe, expect, it } from "vite-plus/test";

import type { HttpControllerOperation } from "./controller-binding.ts";
import { renderHttpControllersFile } from "./render-controllers.ts";

function operation(
  overrides: Partial<HttpControllerOperation> & Pick<HttpControllerOperation, "operationId">,
): HttpControllerOperation {
  return {
    useCaseTypeName: `${overrides.operationId}UseCase`,
    useCaseFilePath: `src/core/use-cases/${overrides.operationId}.ts`,
    wrapperName: `${overrides.operationId}Wrapper`,
    wrapperImportPath: `src/generated/contracts/server/${overrides.operationId}.ts`,
    hasJsonRequestBody: false,
    hasJsonSuccessBody: true,
    successStatus: "200",
    successMediaType: "application/json",
    requiresAuth: false,
    useCaseArgumentExpressions: [],
    ...overrides,
  };
}

describe("Given renderHttpControllersFile", () => {
  it("when given a complete public binding, then it emits wrappers without authenticator types", () => {
    const file = renderHttpControllersFile({
      filePath: "src/adapters/http/controllers.ts",
      hasAuthenticator: false,
      operations: [
        operation({
          operationId: "getItem",
          responseMapName: "getItemResponseMap",
          responseMapImportPath: "src/generated/contracts/routes/getItem.ts",
          useCaseArgumentExpressions: ["request.value.path.itemId"],
        }),
      ],
    });

    expect(file.path).toBe("src/adapters/http/controllers.ts");
    expect(file.ownership).toBe("generated");
    expect(file.contents).toContain("getItemWrapper");
    expect(file.contents).toContain('status: "200"');
    expect(file.contents).toContain(
      'data: getItemResponseMap["200"]["application/json"].parse(result),',
    );
    expect(file.contents).not.toContain("authenticator");
  });

  it("when a binding has no JSON success body, then the controller returns status only", () => {
    const file = renderHttpControllersFile({
      filePath: "src/adapters/http-next/controllers.ts",
      hasAuthenticator: false,
      operations: [
        operation({
          operationId: "deleteItem",
          hasJsonSuccessBody: false,
          successStatus: "204",
          successMediaType: undefined,
          notFoundStatus: "404",
        }),
      ],
    });

    expect(file.contents).toContain('if (!result) return { status: "404" };');
    expect(file.contents).toContain('return { status: "204" };');
    expect(file.contents).not.toContain("ResponseMap");
  });

  it("when a JSON body operation requires auth, then validation and invocation use the binding", () => {
    const file = renderHttpControllersFile({
      filePath: "src/adapters/http-next/controllers.ts",
      hasAuthenticator: true,
      operations: [
        operation({
          operationId: "createItem",
          hasJsonRequestBody: true,
          requiresAuth: true,
          useCaseArgumentExpressions: ["principal", "request.value.body"],
          responseMapName: "createItemResponseMap",
          responseMapImportPath: "src/generated/contracts/routes/createItem.ts",
          successStatus: "201",
        }),
      ],
    });

    expect(file.contents).toContain("principal: Principal");
    expect(file.contents).toContain('throw new AuthenticationError("authenticator-missing")');
    expect(file.contents).toContain(
      'throw new RequestValidationError(request.isValid ? "body-error" : request.kind);',
    );
    expect(file.contents).toContain("await useCases.createItem(principal, request.value.body)");
  });

  it("when a secured operation has no JSON body, then header errors become AuthenticationError", () => {
    const file = renderHttpControllersFile({
      filePath: "src/adapters/http/controllers.ts",
      hasAuthenticator: true,
      operations: [
        operation({
          operationId: "getItem",
          requiresAuth: true,
          hasJsonSuccessBody: false,
          successMediaType: undefined,
          useCaseArgumentExpressions: ["principal", "request.value.path.itemId"],
        }),
      ],
    });

    expect(file.contents).toContain('if (!request.isValid && request.kind === "headers-error") {');
    expect(file.contents).toContain("await useCases.getItem(principal, request.value.path.itemId)");
    expect(file.contents).not.toContain("const result = await");
  });

  it("when operations are unsorted, then emitted fields are ordered by operationId", () => {
    const file = renderHttpControllersFile({
      filePath: "src/adapters/http/controllers.ts",
      hasAuthenticator: false,
      operations: [operation({ operationId: "zeta" }), operation({ operationId: "alpha" })],
    });

    const alpha = file.contents.indexOf("alpha:");
    const zeta = file.contents.indexOf("zeta:");
    expect(alpha).toBeGreaterThan(-1);
    expect(zeta).toBeGreaterThan(alpha);
  });
});
