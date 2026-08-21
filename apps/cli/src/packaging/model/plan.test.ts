import { describe, expect, it } from "vite-plus/test";

import type { ContractArtifact } from "@hexkit/plugin-apical";
import type { PersistenceArtifact } from "@hexkit/plugin-drizzle";
import type { HttpArtifact } from "@hexkit/plugin-hono";
import type { NextHttpArtifact } from "@hexkit/plugin-next";

import { buildHonoPackagingPlan, buildNextPackagingPlan } from "./plan.ts";

function catalogContract(): ContractArtifact {
  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: {
      title: "Catalog API",
      version: "1.0.0",
      slug: "catalog-api",
    },
    schemas: [],
    securitySchemes: [],
    globalSecurity: [],
    operations: [],
  };
}

function catalogPersistence(): PersistenceArtifact {
  return {
    artifactVersion: 1,
    schemaFilePath: "src/adapters/db/schema.ts",
    mapperFilePath: "src/adapters/db/mappers.ts",
    migrationPath: "drizzle/0000_catalog-api.sql",
    tables: [],
    mappers: [],
    repositories: [
      {
        aggregate: "Item",
        portName: "ItemRepository",
        factoryName: "createDrizzleItemRepository",
        filePath: "src/adapters/db/item-repository.ts",
        runtimeKey: "items",
      },
    ],
  };
}

function catalogHttp(): HttpArtifact {
  return {
    artifactVersion: 1,
    controllersFilePath: "src/adapters/http/controllers.ts",
    routesFilePath: "src/adapters/http/routes.ts",
    runtimeFilePath: "src/runtime/app.ts",
    createAppFactoryName: "createApp",
    createHonoAppFactoryName: "createHonoApp",
    runtimeRepositoriesTypeName: "RuntimeRepositories",
    repositories: [
      {
        parameterName: "items",
        repositoryName: "ItemRepository",
        repositoryFilePath: "src/core/ports/item-repository.ts",
      },
    ],
    operations: [],
  };
}

function catalogNextHttp(): NextHttpArtifact {
  return {
    artifactVersion: 1,
    surface: "routes",
    serverAccessFilePath: "src/adapters/http-next/server-access.ts",
    routes: [],
    uiPages: [],
    repositories: [
      {
        aggregate: "Item",
        name: "ItemRepository",
        filePath: "src/core/ports/item-repository.ts",
        parameterName: "items",
        methods: [],
      },
    ],
  };
}

describe("Given matching HTTP and persistence artifacts", () => {
  it("when a Hono plan is built, then compose uses the slug as a database identifier", () => {
    const plan = buildHonoPackagingPlan({
      contract: catalogContract(),
      http: catalogHttp(),
      persistence: catalogPersistence(),
    });

    expect(plan.kind).toBe("hono");
    expect(plan.packageName).toBe("generated-catalog-api");
    expect(plan.compose).toEqual({
      databaseName: "catalog_api",
      appService: { name: "app" },
    });
    expect(plan.repositories).toEqual([
      {
        runtimeKey: "items",
        factoryName: "createDrizzleItemRepository",
        filePath: "src/adapters/db/item-repository.ts",
      },
    ]);
  });

  it("when a Next plan is built, then resolved repositories are kept as plan data", () => {
    const plan = buildNextPackagingPlan({
      contract: catalogContract(),
      nextHttp: catalogNextHttp(),
      persistence: catalogPersistence(),
    });

    expect(plan.kind).toBe("next");
    expect(plan.repositories).toEqual([
      {
        runtimeKey: "items",
        factoryName: "createDrizzleItemRepository",
        filePath: "src/adapters/db/item-repository.ts",
      },
    ]);
    expect(plan.compose.appService.name).toBe("next");
    expect(plan.compose.appService.healthcheck).toEqual({
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/"],
      startPeriod: "45s",
    });
  });
});
