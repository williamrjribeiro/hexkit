import { describe, expect, it } from "vite-plus/test";

import type { ContractArtifact, ContractSchema } from "@hexkit/plugin-apical";
import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";

import { derivePersistenceModel } from "./derive.ts";

function emptyApplication(
  repositories: ApplicationArtifact["repositories"] = [],
): ApplicationArtifact {
  return {
    artifactVersion: 1,
    entities: [],
    repositories,
    useCases: [],
  };
}

function baseContract(
  slug: string,
  schemas: ContractArtifact["schemas"],
  operations: ContractArtifact["operations"] = [],
): ContractArtifact {
  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: { title: slug, version: "1.0.0", slug },
    schemas,
    securitySchemes: [],
    globalSecurity: [],
    operations,
  };
}

function widgetSchema(overrides: Partial<ContractSchema> = {}): ContractSchema {
  return {
    name: "Widget",
    modulePath: "schemas/Widget.ts",
    persistence: { table: "widgets", identity: "id" },
    properties: [
      {
        name: "id",
        required: true,
        type: { kind: "integer", nullable: false, format: "int32" },
      },
      {
        name: "name",
        required: true,
        type: { kind: "string", nullable: false },
      },
    ],
    ...overrides,
  };
}

function operation(
  operationId: string,
  method: ContractArtifact["operations"][number]["method"],
  path: string,
  extension?: { aggregate: string; action: string },
): ContractArtifact["operations"][number] {
  return {
    operationId,
    method,
    path,
    modulePath: `routes/${operationId}.ts`,
    parameters: [],
    responses: [
      {
        status: "200",
        description: "ok",
        media: [
          {
            mediaType: "application/json",
            type: { kind: "reference", nullable: false, schema: "Widget" },
          },
        ],
      },
    ],
    security: {
      overridesGlobal: false,
      requirements: [],
      apicalServerHeaderNames: [],
    },
    ...(extension === undefined ? {} : { extension }),
  };
}

describe("derivePersistenceModel validation edges", () => {
  it("rejects persistence identity that is not a property", () => {
    const contract = baseContract("bad-identity-api", [
      widgetSchema({
        persistence: { table: "widgets", identity: "missing" },
      }),
    ]);
    expect(() => derivePersistenceModel(contract, emptyApplication())).toThrow(
      'Schema "Widget" persistence identity "missing" is not a property.',
    );
  });

  it("rejects FK references to an unknown schema", () => {
    const contract = baseContract("unknown-fk-api", [
      widgetSchema({
        properties: [
          {
            name: "id",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
          },
          {
            name: "ownerId",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
            reference: { schema: "MissingOwner", property: "id" },
          },
        ],
      }),
    ]);
    expect(() => derivePersistenceModel(contract, emptyApplication())).toThrow(
      'Schema "Widget" property "ownerId" references unknown schema "MissingOwner".',
    );
  });

  it("rejects FK references to a schema without persistence", () => {
    const contract = baseContract("no-persist-fk-api", [
      {
        name: "Owner",
        modulePath: "schemas/Owner.ts",
        properties: [
          {
            name: "id",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
          },
        ],
      },
      widgetSchema({
        properties: [
          {
            name: "id",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
          },
          {
            name: "ownerId",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
            reference: { schema: "Owner", property: "id" },
          },
        ],
      }),
    ]);
    expect(() => derivePersistenceModel(contract, emptyApplication())).toThrow(
      'Schema "Widget" property "ownerId" references "Owner" which has no x-hexkit.persistence.',
    );
  });

  it("rejects foreign-key cycles between tables", () => {
    const contract = baseContract("cycle-api", [
      {
        name: "Left",
        modulePath: "schemas/Left.ts",
        persistence: { table: "lefts", identity: "id" },
        properties: [
          {
            name: "id",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
          },
          {
            name: "rightId",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
            reference: { schema: "Right", property: "id" },
          },
        ],
      },
      {
        name: "Right",
        modulePath: "schemas/Right.ts",
        persistence: { table: "rights", identity: "id" },
        properties: [
          {
            name: "id",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
          },
          {
            name: "leftId",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
            reference: { schema: "Left", property: "id" },
          },
        ],
      },
    ]);
    expect(() => derivePersistenceModel(contract, emptyApplication())).toThrow(
      /Cannot order persistence tables due to a foreign-key cycle/,
    );
  });

  it("rejects application repositories whose aggregate is not persisted", () => {
    const contract = baseContract("no-agg-api", [widgetSchema()]);
    const application = emptyApplication([
      {
        aggregate: "Ghost",
        name: "GhostRepository",
        filePath: "src/core/ports/ghost-repository.ts",
        parameterName: "ghosts",
        methods: [],
      },
    ]);
    expect(() => derivePersistenceModel(contract, application)).toThrow(
      'Application repository aggregate "Ghost" has no schema with x-hexkit.persistence.',
    );
  });

  it("rejects repository methods with no matching contract operation", () => {
    const contract = baseContract("missing-op-api", [widgetSchema()]);
    const application = emptyApplication([
      {
        aggregate: "Widget",
        name: "WidgetRepository",
        filePath: "src/core/ports/widget-repository.ts",
        parameterName: "widgets",
        methods: [
          {
            operationId: "missingOp",
            name: "missingOp",
            action: "create",
            parameters: [],
            returnTypeExpression: "Widget",
          },
        ],
      },
    ]);
    expect(() => derivePersistenceModel(contract, application)).toThrow(
      'Application repository method "missingOp" has no matching contract operation.',
    );
  });

  it("rejects non-string enum values", () => {
    const contract = baseContract("bad-enum-api", [
      widgetSchema({
        properties: [
          {
            name: "id",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
          },
          {
            name: "status",
            required: true,
            type: { kind: "string", nullable: false, enum: [1 as unknown as string] },
          },
        ],
      }),
    ]);
    expect(() => derivePersistenceModel(contract, emptyApplication())).toThrow(
      'Schema "Widget" property "status" enum values must be strings for Postgres enums.',
    );
  });

  it("dedupes colliding enum sql names across schemas", () => {
    // toSnakeCase("Foo_BarBaz") === toSnakeCase("FooBar_Baz") === "foo_bar_baz"
    const contract = baseContract("enum-collision-api", [
      {
        name: "Foo",
        modulePath: "schemas/Foo.ts",
        persistence: { table: "foos", identity: "id" },
        properties: [
          {
            name: "id",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
          },
          {
            name: "BarBaz",
            required: true,
            type: { kind: "string", nullable: false, enum: ["a", "b"] },
          },
        ],
      },
      {
        name: "FooBar",
        modulePath: "schemas/FooBar.ts",
        persistence: { table: "foobars", identity: "id" },
        properties: [
          {
            name: "id",
            required: true,
            type: { kind: "integer", nullable: false, format: "int32" },
          },
          {
            name: "Baz",
            required: true,
            type: { kind: "string", nullable: false, enum: ["a", "b"] },
          },
        ],
      },
    ]);
    const model = derivePersistenceModel(contract, emptyApplication());
    expect(model.enums).toHaveLength(1);
    expect(model.enums[0]?.sqlName).toBe("foo_bar_baz");
  });
});

describe("derivePersistenceModel method-kind edges", () => {
  function appWithMethod(
    operationId: string,
    action: string,
    returnTypeExpression: string,
    parameters: ApplicationArtifact["repositories"][number]["methods"][number]["parameters"] = [],
  ): ApplicationArtifact {
    return emptyApplication([
      {
        aggregate: "Widget",
        name: "WidgetRepository",
        filePath: "src/core/ports/widget-repository.ts",
        parameterName: "widgets",
        methods: [
          {
            operationId,
            name: operationId,
            action,
            parameters,
            returnTypeExpression,
          },
        ],
      },
    ]);
  }

  it("maps explicit update and delete actions", () => {
    const contract = baseContract(
      "action-api",
      [widgetSchema()],
      [
        operation("touchWidget", "put", "/widgets/{id}", { aggregate: "Widget", action: "update" }),
        operation("dropWidget", "post", "/widgets/{id}/drop", {
          aggregate: "Widget",
          action: "remove",
        }),
      ],
    );
    const application = emptyApplication([
      {
        aggregate: "Widget",
        name: "WidgetRepository",
        filePath: "src/core/ports/widget-repository.ts",
        parameterName: "widgets",
        methods: [
          {
            operationId: "touchWidget",
            name: "touchWidget",
            action: "update",
            parameters: [{ name: "widget", typeExpression: "Widget" }],
            returnTypeExpression: "Widget",
          },
          {
            operationId: "dropWidget",
            name: "dropWidget",
            action: "remove",
            parameters: [{ name: "id", typeExpression: "number" }],
            returnTypeExpression: "void",
          },
        ],
      },
    ]);
    const model = derivePersistenceModel(contract, application);
    expect(model.repositories[0]?.methods.map((method) => method.kind)).toEqual([
      "update",
      "delete",
    ]);
  });

  it("infers select from HTTP GET when action does not match named patterns", () => {
    const contract = baseContract(
      "fetch-api",
      [widgetSchema()],
      [operation("fetchWidget", "get", "/widgets/{id}", { aggregate: "Widget", action: "fetch" })],
    );
    const application = appWithMethod("fetchWidget", "fetch", "Widget | undefined", [
      { name: "id", typeExpression: "number" },
    ]);
    const model = derivePersistenceModel(contract, application);
    expect(model.repositories[0]?.methods[0]?.kind).toBe("select");
  });

  it("throws for unsupported HTTP methods when action cannot be inferred", () => {
    const contract = baseContract(
      "options-api",
      [widgetSchema()],
      [operation("probeWidget", "options", "/widgets", { aggregate: "Widget", action: "probe" })],
    );
    const application = appWithMethod("probeWidget", "probe", "Widget");
    expect(() => derivePersistenceModel(contract, application)).toThrow(
      /Cannot infer persistence action for operation "probeWidget"/,
    );
  });

  it("refines parameterless select into list when return type is Array", () => {
    const contract = baseContract(
      "search-list-api",
      [widgetSchema()],
      [operation("searchWidgets", "get", "/widgets", { aggregate: "Widget", action: "search" })],
    );
    const application = appWithMethod("searchWidgets", "search", "Array<Widget>");
    const model = derivePersistenceModel(contract, application);
    expect(model.repositories[0]?.methods[0]?.kind).toBe("list");
  });

  it("refines parameterless select into stub when return type is not Array", () => {
    const contract = baseContract(
      "search-stub-api",
      [widgetSchema()],
      [operation("probeReady", "get", "/ready", { aggregate: "Widget", action: "probe" })],
    );
    const application = appWithMethod("probeReady", "probe", "{ ok: boolean }");
    const model = derivePersistenceModel(contract, application);
    expect(model.repositories[0]?.methods[0]?.kind).toBe("stub");
  });
});
