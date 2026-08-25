import { describe, expect, it } from "vite-plus/test";

import type { ContractOperation } from "@hexkit/plugin-apical";

import { deriveAuthSchemes } from "./auth-schemes.ts";
import type { ContractSecurityScheme } from "./media.ts";

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
    path: "/items",
    modulePath: `routes/${overrides.operationId}.ts`,
    parameters: [],
    responses: [{ status: "200", description: "ok", media: [] }],
    security: publicSecurity,
    ...overrides,
  };
}

const apiKeyScheme: ContractSecurityScheme = {
  name: "api_key",
  type: "apiKey",
  in: "header",
  headerName: "X-API-Key",
};

const bearerScheme: ContractSecurityScheme = {
  name: "bearerAuth",
  type: "http",
  scheme: "bearer",
  headerName: "Authorization",
};

const unsupportedScheme: ContractSecurityScheme = {
  name: "oauth",
  type: "unsupported",
  openApiType: "oauth2",
  reason: "not supported",
};

describe("Given operation security requirements", () => {
  it("when Apical emitted no server headers, then no schemes are derived", () => {
    expect(
      deriveAuthSchemes(
        operation({
          operationId: "listItems",
          security: {
            overridesGlobal: true,
            requirements: [{ schemes: ["api_key"], scopes: {} }],
            apicalServerHeaderNames: [],
          },
        }),
        [apiKeyScheme],
      ),
    ).toEqual([]);
  });

  it("when requirements name apiKey and bearer schemes, then bindings keep requirement order", () => {
    expect(
      deriveAuthSchemes(
        operation({
          operationId: "getItem",
          security: {
            overridesGlobal: true,
            requirements: [
              { schemes: ["bearerAuth", "api_key"], scopes: {} },
              { schemes: ["api_key"], scopes: {} },
            ],
            apicalServerHeaderNames: ["Authorization", "X-API-Key"],
          },
        }),
        [apiKeyScheme, bearerScheme],
      ),
    ).toEqual([
      {
        name: "bearerAuth",
        type: "http",
        scheme: "bearer",
        headerName: "Authorization",
      },
      { name: "api_key", type: "apiKey", headerName: "X-API-Key" },
    ]);
  });

  it("when a named scheme is missing or unsupported, then it is skipped", () => {
    expect(
      deriveAuthSchemes(
        operation({
          operationId: "getItem",
          security: {
            overridesGlobal: true,
            requirements: [{ schemes: ["missing", "oauth", "api_key"], scopes: {} }],
            apicalServerHeaderNames: ["X-API-Key"],
          },
        }),
        [apiKeyScheme, unsupportedScheme],
      ),
    ).toEqual([{ name: "api_key", type: "apiKey", headerName: "X-API-Key" }]);
  });
});
