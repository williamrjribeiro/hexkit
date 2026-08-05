import { describe, expect, it } from "vite-plus/test";

import { loadValidatedOpenApi } from "./openapi.ts";
import {
  normalizeGlobalSecurity,
  normalizeSecuritySchemes,
  resolveOperationSecurity,
} from "./security.ts";

const authContract = new URL("../../../../apps/fixtures/auth-api/openapi.yaml", import.meta.url);

async function loadAuthDocument(): Promise<Record<string, unknown>> {
  return (await loadValidatedOpenApi(authContract.pathname)) as Record<string, unknown>;
}

function operationAt(
  document: Record<string, unknown>,
  path: "/health" | "/items",
  method: "get" | "post",
): Record<string, unknown> {
  return (
    (document.paths as Record<string, Record<string, unknown>>)[path] as Record<string, unknown>
  )[method] as Record<string, unknown>;
}

describe("OpenAPI security normalization", () => {
  it("when global bearer is set, then listItems requires authorization server header", async () => {
    const document = await loadAuthDocument();
    const schemes = normalizeSecuritySchemes(document);
    const globalSecurity = normalizeGlobalSecurity(document);

    const security = resolveOperationSecurity(
      document,
      operationAt(document, "/items", "get"),
      schemes,
      globalSecurity,
    );

    expect(security.apicalServerHeaderNames).toEqual(["authorization"]);
  });

  it("when security is empty, then getHealth has no auth headers", async () => {
    const document = await loadAuthDocument();
    const schemes = normalizeSecuritySchemes(document);
    const globalSecurity = normalizeGlobalSecurity(document);

    const security = resolveOperationSecurity(
      document,
      operationAt(document, "/health", "get"),
      schemes,
      globalSecurity,
    );

    expect(security.requirements).toEqual([]);
    expect(security.apicalServerHeaderNames).toEqual([]);
  });

  it("when operation overrides with apiKey, then createItem requires x-api-key only", async () => {
    const document = await loadAuthDocument();
    const schemes = normalizeSecuritySchemes(document);
    const globalSecurity = normalizeGlobalSecurity(document);

    const security = resolveOperationSecurity(
      document,
      operationAt(document, "/items", "post"),
      schemes,
      globalSecurity,
    );

    expect(security.apicalServerHeaderNames).toEqual(["x-api-key"]);
  });

  it("when oauth2 scheme is declared, then it is marked unsupported", async () => {
    const schemes = normalizeSecuritySchemes(await loadAuthDocument());

    expect(schemes).toContainEqual({
      name: "petstore_auth",
      type: "unsupported",
      openApiType: "oauth2",
      reason: expect.any(String),
    });
  });
});
