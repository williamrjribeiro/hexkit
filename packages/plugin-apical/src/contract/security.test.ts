import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parse } from "@babel/parser";
import { beforeAll, describe, expect, it } from "vite-plus/test";

import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
} from "@hexkit/plugin-api";

import { APICAL_CONTRACT_ARTIFACT } from "./index.ts";
import { normalizeContractArtifact } from "./normalize.ts";
import { loadValidatedOpenApi } from "./openapi.ts";
import {
  normalizeGlobalSecurity,
  normalizeSecuritySchemes,
  resolveOperationSecurity,
} from "./security.ts";
import { createApicalPlugin } from "../plugin.ts";

const authContract = new URL("../../../../apps/fixtures/auth-api/openapi.yaml", import.meta.url);
const authGeneratedModules = {
  schemas: new Map([["Item", "schemas/Item.ts"]]),
  operations: new Map([
    ["getHealth", "routes/getHealth.ts"],
    ["listItems", "routes/listItems.ts"],
    ["createItem", "routes/createItem.ts"],
  ]),
};

let authDocument: Record<string, unknown>;

beforeAll(async () => {
  authDocument = (await loadValidatedOpenApi(authContract.pathname)) as Record<string, unknown>;
});

function securitySchemesOf(document: Record<string, unknown>): Record<string, unknown> {
  const components = (document.components ?? {}) as Record<string, unknown>;
  return (components.securitySchemes ?? {}) as Record<string, unknown>;
}

function resolveSecurity(
  document: Record<string, unknown>,
  operation: Record<string, unknown>,
  pathItem: Record<string, unknown> = {},
) {
  return resolveOperationSecurity({
    operationSecurity: operation.security,
    pathItemSecurity: pathItem.security,
    globalSecurity: normalizeGlobalSecurity(document),
    schemes: normalizeSecuritySchemes(securitySchemesOf(document)),
  });
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

function serverHeadersSchemaKeys(source: string, schemaName: string): readonly string[] {
  const sourceFile = parse(source, {
    sourceFilename: `${schemaName}.ts`,
    sourceType: "module",
    plugins: ["typescript"],
  });

  for (const statement of sourceFile.program.body) {
    if (statement.type !== "VariableDeclaration") continue;

    for (const declaration of statement.declarations) {
      if (declaration.id.type !== "Identifier" || declaration.id.name !== schemaName) continue;
      const initializer = declaration.init;
      if (
        initializer?.type !== "CallExpression" ||
        initializer.callee.type !== "MemberExpression" ||
        initializer.callee.property.type !== "Identifier" ||
        initializer.callee.property.name !== "object"
      ) {
        throw new Error(`${schemaName} must be initialized with z.object(...).`);
      }

      const shape = initializer.arguments[0];
      if (shape?.type !== "ObjectExpression") {
        throw new Error(`${schemaName} must pass an object literal to z.object(...).`);
      }

      return shape.properties.map((property) => {
        if (property.type !== "ObjectProperty") {
          throw new Error(`${schemaName} contains an unsupported header schema property.`);
        }
        if (property.key.type === "StringLiteral") return property.key.value;
        if (property.key.type === "Identifier") return property.key.name;
        throw new Error(`${schemaName} contains an unsupported header schema key.`);
      });
    }
  }

  return [];
}

describe("OpenAPI security normalization", () => {
  it("when global bearer is set, then listItems requires authorization server header", () => {
    const security = resolveSecurity(authDocument, operationAt(authDocument, "/items", "get"));

    expect(security.apicalServerHeaderNames).toEqual(["authorization"]);
  });

  it("when security is empty, then getHealth has no auth headers", () => {
    const security = resolveSecurity(authDocument, operationAt(authDocument, "/health", "get"));

    expect(security.requirements).toEqual([]);
    expect(security.apicalServerHeaderNames).toEqual([]);
  });

  it("when operation overrides with apiKey, then createItem requires x-api-key only", () => {
    const security = resolveSecurity(authDocument, operationAt(authDocument, "/items", "post"));

    expect(security.apicalServerHeaderNames).toEqual(["x-api-key"]);
  });

  it("when oauth2 scheme is declared, then it is marked unsupported", () => {
    const schemes = normalizeSecuritySchemes(securitySchemesOf(authDocument));

    expect(schemes).toContainEqual({
      name: "implicitOAuth",
      type: "unsupported",
      openApiType: "oauth2",
      reason: expect.any(String),
    });
  });

  it("when path-item security is set and the operation omits security, then the path-item requirement applies", () => {
    const document: Record<string, unknown> = {
      openapi: "3.1.0",
      info: { title: "Path Security", version: "1.0.0" },
      components: {
        securitySchemes: {
          apiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
        },
      },
      paths: {
        "/items": {
          security: [{ apiKey: [] }],
          get: {
            operationId: "listItems",
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };
    const pathItem = (document.paths as Record<string, Record<string, unknown>>)["/items"]!;
    const operation = pathItem.get as Record<string, unknown>;

    const security = resolveSecurity(document, operation, pathItem);

    expect(security.overridesGlobal).toBe(true);
    expect(security.apicalServerHeaderNames).toEqual(["x-api-key"]);
  });

  it("when security ORs bearer with oauth2, then only the enforceable bearer branch contributes headers", () => {
    const document: Record<string, unknown> = {
      openapi: "3.1.0",
      info: { title: "Or Security", version: "1.0.0" },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer" },
          implicitOAuth: {
            type: "oauth2",
            flows: {
              implicit: {
                authorizationUrl: "https://example.com/oauth/authorize",
                scopes: { read: "read" },
              },
            },
          },
        },
      },
      paths: {
        "/items": {
          get: {
            operationId: "listItems",
            security: [{ bearerAuth: [] }, { implicitOAuth: ["read"] }],
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };
    const schemes = normalizeSecuritySchemes(securitySchemesOf(document));
    const operation = operationAt(document as never, "/items", "get");

    const security = resolveOperationSecurity({
      operationSecurity: operation.security,
      globalSecurity: [],
      schemes,
    });

    expect(security.apicalServerHeaderNames).toEqual(["authorization"]);
    expect(() =>
      normalizeContractArtifact(
        {
          ...document,
          paths: {
            "/items": {
              get: {
                ...operation,
                "x-hexkit": { operation: { aggregate: "Item", action: "list" } },
                responses: {
                  "200": {
                    description: "ok",
                    content: {
                      "application/json": {
                        schema: { type: "object", properties: { ok: { type: "boolean" } } },
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            ...(document.components as object),
            schemas: {
              Item: {
                type: "object",
                required: ["id"],
                properties: { id: { type: "string" } },
                "x-hexkit": { persistence: { table: "items", identity: "id" } },
              },
            },
          },
        },
        {
          schemas: new Map([["Item", "schemas/Item.ts"]]),
          operations: new Map([["listItems", "routes/listItems.ts"]]),
        },
      ),
    ).not.toThrow();
  });

  it("when security scopes are not an array, then normalization fails", () => {
    expect(() =>
      normalizeSecuritySchemes({
        bearerAuth: { type: "http", scheme: "bearer" },
      }),
    ).not.toThrow();

    expect(() =>
      normalizeGlobalSecurity({
        security: [{ bearerAuth: "read" }],
      }),
    ).toThrow("OpenAPI security[0].bearerAuth must be an array of scope names.");
  });

  it("when document.security is not an array, then normalization fails", () => {
    expect(() => normalizeGlobalSecurity({ security: { bearerAuth: [] } })).toThrow(
      "OpenAPI security must be an array.",
    );
  });

  it("when apiKey is not in header, then the scheme is unsupported", () => {
    const schemes = normalizeSecuritySchemes({
      cookieKey: { type: "apiKey", in: "cookie", name: "session" },
    });

    expect(schemes).toEqual([
      {
        name: "cookieKey",
        type: "unsupported",
        openApiType: "apiKey",
        reason: expect.stringContaining('location "cookie"'),
      },
    ]);
  });

  it("when http scheme is not bearer, then the scheme is unsupported", () => {
    const schemes = normalizeSecuritySchemes({
      basicAuth: { type: "http", scheme: "basic" },
    });

    expect(schemes).toEqual([
      {
        name: "basicAuth",
        type: "unsupported",
        openApiType: "http",
        reason: expect.stringContaining('"basic"'),
      },
    ]);
  });

  it("when one requirement ANDs a supported scheme with oauth2, then normalization fails", () => {
    const document = {
      openapi: "3.1.0",
      info: { title: "And Mix", version: "1.0.0" },
      components: {
        schemas: {
          Item: {
            type: "object",
            required: ["id"],
            properties: { id: { type: "string" } },
            "x-hexkit": { persistence: { table: "items", identity: "id" } },
          },
        },
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer" },
          implicitOAuth: {
            type: "oauth2",
            flows: {
              implicit: {
                authorizationUrl: "https://example.com/oauth/authorize",
                scopes: { read: "read" },
              },
            },
          },
        },
      },
      paths: {
        "/items": {
          get: {
            operationId: "listItems",
            "x-hexkit": { operation: { aggregate: "Item", action: "list" } },
            security: [{ bearerAuth: [], implicitOAuth: ["read"] }],
            responses: {
              "200": {
                description: "ok",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/Item" } },
                },
              },
            },
          },
        },
      },
    };

    expect(() =>
      normalizeContractArtifact(document, {
        schemas: new Map([["Item", "schemas/Item.ts"]]),
        operations: new Map([["listItems", "routes/listItems.ts"]]),
      }),
    ).toThrow(/AND of multiple security schemes/);
  });
});

describe("ContractArtifact security metadata", () => {
  it("when auth OpenAPI is normalized, then artifact and operations expose security metadata", () => {
    const artifact = normalizeContractArtifact(authDocument, authGeneratedModules);
    const operationsById = new Map(
      artifact.operations.map((operation) => [operation.operationId, operation]),
    );

    expect(artifact.securitySchemes).toEqual([
      {
        name: "bearerAuth",
        type: "http",
        scheme: "bearer",
        headerName: "Authorization",
        bearerFormat: "JWT",
      },
      { name: "apiKey", type: "apiKey", in: "header", headerName: "X-API-Key" },
      {
        name: "implicitOAuth",
        type: "unsupported",
        openApiType: "oauth2",
        reason: expect.any(String),
      },
    ]);
    expect(artifact.globalSecurity).toEqual([
      { schemes: ["bearerAuth"], scopes: { bearerAuth: [] } },
    ]);
    expect(operationsById.get("listItems")?.security).toEqual({
      overridesGlobal: false,
      requirements: [{ schemes: ["bearerAuth"], scopes: { bearerAuth: [] } }],
      apicalServerHeaderNames: ["authorization"],
    });
    expect(operationsById.get("getHealth")?.security).toEqual({
      overridesGlobal: true,
      requirements: [],
      apicalServerHeaderNames: [],
    });
    expect(operationsById.get("createItem")?.security).toEqual({
      overridesGlobal: true,
      requirements: [{ schemes: ["apiKey"], scopes: { apiKey: [] } }],
      apicalServerHeaderNames: ["x-api-key"],
    });
  });

  it("when craft emits server header schemas, then IR apicalServerHeaderNames match schema keys", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "hexkit-auth-apical-test-"));
    const files: GeneratedFile[] = [];
    const context: GenerationContext = {
      inputPath: authContract.pathname,
      outputDirectory,
      artifacts: createArtifactRegistry(),
      writeFile(file) {
        files.push(file);
      },
      log() {},
    };

    try {
      await createApicalPlugin().generate(context);
      const artifact = context.artifacts.require(APICAL_CONTRACT_ARTIFACT);

      for (const operation of artifact.operations) {
        const schemaName = `${operation.operationId}ServerHeadersSchema`;
        const parametersPath = join(
          outputDirectory,
          "src/generated/contracts/schemas",
          `${operation.operationId}Parameters.ts`,
        );
        const parametersSource = await readFile(parametersPath, "utf8");

        expect(operation.security.apicalServerHeaderNames).toEqual(
          serverHeadersSchemaKeys(parametersSource, schemaName),
        );
      }
      expect(files).toContainEqual(
        expect.objectContaining({ path: "src/generated/contracts/hexkit-contract.json" }),
      );
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
});
