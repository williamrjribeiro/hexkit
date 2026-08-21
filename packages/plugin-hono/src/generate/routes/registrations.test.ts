import { describe, expect, it } from "vite-plus/test";

import type { HttpOperationBinding } from "../../artifact.ts";
import { renderRouteRegistration, renderSecurityMeta } from "./registrations.ts";

function binding(
  overrides: Partial<HttpOperationBinding> &
    Pick<HttpOperationBinding, "operationId" | "method" | "honoPath">,
): HttpOperationBinding {
  return {
    openApiPath: overrides.honoPath.replaceAll(/:([^/]+)/g, "{$1}"),
    useCaseTypeName: "GetItem",
    useCaseFactoryName: "createGetItem",
    useCaseFilePath: "src/core/use-cases/get-item.ts",
    repositoryParameterName: "items",
    wrapperName: `${overrides.operationId}Wrapper`,
    wrapperImportPath: `src/generated/contracts/server/${overrides.operationId}.ts`,
    successStatus: "200",
    hasJsonRequestBody: false,
    hasJsonSuccessBody: true,
    successMediaType: "application/json",
    requiresAuth: false,
    authSchemes: [],
    useCaseArgumentExpressions: ["request.value.path.itemId"],
    ...overrides,
  };
}

describe("Given one public GET HttpOperationBinding", () => {
  it("when renderRouteRegistration runs, then it emits method, path, and controller call", () => {
    const operation = binding({
      operationId: "getItem",
      method: "get",
      honoPath: "/items/:itemId",
    });

    expect(renderRouteRegistration(operation)).toBe(
      [
        '  app.get("/items/:itemId", async (context) =>',
        "    respond(await controllers.getItem(request(context))),",
        "  );",
      ].join("\n"),
    );
  });
});

describe("Given one public JSON POST HttpOperationBinding", () => {
  it("when renderRouteRegistration runs, then it awaits jsonRequest", () => {
    const operation = binding({
      operationId: "createItem",
      method: "post",
      honoPath: "/items",
      hasJsonRequestBody: true,
      successStatus: "201",
      useCaseArgumentExpressions: ["request.value.body"],
    });

    expect(renderRouteRegistration(operation)).toBe(
      [
        '  app.post("/items", async (context) =>',
        "    respond(await controllers.createItem(await jsonRequest(context))),",
        "  );",
      ].join("\n"),
    );
  });
});

describe("Given one secured HttpOperationBinding", () => {
  it("when renderRouteRegistration runs, then it registers auth middleware and passes principal", () => {
    const operation = binding({
      operationId: "createItem",
      method: "post",
      honoPath: "/items",
      hasJsonRequestBody: true,
      requiresAuth: true,
      authMiddlewareName: "authenticateCreateItem",
      authSchemes: [{ name: "internalKey", type: "apiKey", headerName: "X-Internal-Key" }],
      useCaseArgumentExpressions: ["principal", "request.value.body"],
    });

    expect(renderRouteRegistration(operation)).toBe(
      [
        '  const authenticateCreateItem = createAuthenticateMiddleware(authenticator, { schemes: [{ name: "internalKey", type: "apiKey", headerName: "X-Internal-Key" }] });',
        '  app.post("/items", authenticateCreateItem, async (context) =>',
        "    respond(await controllers.createItem(await jsonRequest(context), context.var.principal)),",
        "  );",
      ].join("\n"),
    );
  });

  it("when authMiddlewareName is missing, then the route stays unauthenticated", () => {
    const operation = binding({
      operationId: "getItem",
      method: "get",
      honoPath: "/items/:itemId",
      requiresAuth: true,
      authSchemes: [
        { name: "adminBearer", type: "http", scheme: "bearer", headerName: "Authorization" },
      ],
    });

    expect(renderRouteRegistration(operation)).toBe(
      [
        '  app.get("/items/:itemId", async (context) =>',
        "    respond(await controllers.getItem(request(context), context.var.principal)),",
        "  );",
      ].join("\n"),
    );
  });
});

describe("Given operation auth schemes", () => {
  it("when renderSecurityMeta runs, then apiKey and bearer schemes are serialized", () => {
    const operation = binding({
      operationId: "createItem",
      method: "post",
      honoPath: "/items",
      requiresAuth: true,
      authMiddlewareName: "authenticateCreateItem",
      authSchemes: [
        { name: "internalKey", type: "apiKey", headerName: "X-Internal-Key" },
        { name: "adminBearer", type: "http", scheme: "bearer", headerName: "Authorization" },
      ],
    });

    expect(renderSecurityMeta(operation)).toBe(
      '{ schemes: [{ name: "internalKey", type: "apiKey", headerName: "X-Internal-Key" }, { name: "adminBearer", type: "http", scheme: "bearer", headerName: "Authorization" }] }',
    );
  });
});
