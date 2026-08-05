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
    const schemes = normalizeSecuritySchemes(authDocument);
    const globalSecurity = normalizeGlobalSecurity(authDocument);

    const security = resolveOperationSecurity(
      authDocument,
      operationAt(authDocument, "/items", "get"),
      schemes,
      globalSecurity,
    );

    expect(security.apicalServerHeaderNames).toEqual(["authorization"]);
  });

  it("when security is empty, then getHealth has no auth headers", () => {
    const schemes = normalizeSecuritySchemes(authDocument);
    const globalSecurity = normalizeGlobalSecurity(authDocument);

    const security = resolveOperationSecurity(
      authDocument,
      operationAt(authDocument, "/health", "get"),
      schemes,
      globalSecurity,
    );

    expect(security.requirements).toEqual([]);
    expect(security.apicalServerHeaderNames).toEqual([]);
  });

  it("when operation overrides with apiKey, then createItem requires x-api-key only", () => {
    const schemes = normalizeSecuritySchemes(authDocument);
    const globalSecurity = normalizeGlobalSecurity(authDocument);

    const security = resolveOperationSecurity(
      authDocument,
      operationAt(authDocument, "/items", "post"),
      schemes,
      globalSecurity,
    );

    expect(security.apicalServerHeaderNames).toEqual(["x-api-key"]);
  });

  it("when oauth2 scheme is declared, then it is marked unsupported", () => {
    const schemes = normalizeSecuritySchemes(authDocument);

    expect(schemes).toContainEqual({
      name: "implicitOAuth",
      type: "unsupported",
      openApiType: "oauth2",
      reason: expect.any(String),
    });
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
