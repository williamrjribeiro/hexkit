import { describe, expect, it } from "vite-plus/test";

import type { ContractOperation } from "@hexkit/plugin-apical";
import type { ApplicationRepository } from "@hexkit/plugin-architecture-hexagonal";

import { deriveRepository } from "./repository.ts";
import { deriveTable } from "./table.ts";

function widgetSchema() {
  return {
    name: "Widget",
    modulePath: "schemas/Widget.ts",
    persistence: { table: "widgets", identity: "id" },
    properties: [
      {
        name: "id",
        required: true,
        type: { kind: "integer" as const, nullable: false, format: "int32" },
      },
      {
        name: "name",
        required: true,
        type: { kind: "string" as const, nullable: false },
      },
    ],
  };
}

function operation(operationId: string, method: ContractOperation["method"]): ContractOperation {
  return {
    operationId,
    method,
    path: "/widgets",
    modulePath: `routes/${operationId}.ts`,
    parameters: [],
    responses: [],
    security: { overridesGlobal: false, requirements: [], apicalServerHeaderNames: [] },
  };
}

function applicationRepository(methods: ApplicationRepository["methods"]): ApplicationRepository {
  return {
    aggregate: "Widget",
    name: "WidgetRepository",
    filePath: "src/core/ports/widget-repository.ts",
    parameterName: "widgets",
    methods,
  };
}

function repositoryMethod(
  method: Omit<ApplicationRepository["methods"][number], "resultCardinality" | "persistenceKind"> &
    Partial<
      Pick<ApplicationRepository["methods"][number], "resultCardinality" | "persistenceKind">
    >,
): ApplicationRepository["methods"][number] {
  return {
    resultCardinality: "one",
    persistenceKind: "insert",
    ...method,
  };
}

describe("deriveRepository", () => {
  const table = deriveTable(widgetSchema(), new Map());
  const tablesBySchema = new Map([["Widget", table]]);

  it("when methods have parameters, then entity and identity names come from the first parameter", () => {
    const operationsById = new Map([
      ["createWidget", operation("createWidget", "post")],
      ["getWidget", operation("getWidget", "get")],
    ] as const);

    const repository = deriveRepository(
      applicationRepository([
        repositoryMethod({
          operationId: "createWidget",
          name: "createWidget",
          action: "create",
          parameters: [{ name: "widget", typeExpression: "Widget" }],
          returnTypeExpression: "Widget",
          persistenceKind: "insert",
        }),
        repositoryMethod({
          operationId: "getWidget",
          name: "getWidget",
          action: "get",
          parameters: [{ name: "widgetId", typeExpression: "number" }],
          returnTypeExpression: "Widget | undefined",
          persistenceKind: "select",
        }),
      ]),
      tablesBySchema,
      operationsById,
    );

    expect(repository.methods[0]).toMatchObject({
      kind: "insert",
      entityParameterName: "widget",
      identityParameterName: "widget",
    });
    expect(repository.methods[1]).toMatchObject({
      kind: "select",
      entityParameterName: "widgetId",
      identityParameterName: "widgetId",
    });
  });

  it("when methods have no parameters, then names fall back to schema and identity", () => {
    const operationsById = new Map([
      ["createWidget", operation("createWidget", "post")],
      ["getWidget", operation("getWidget", "get")],
    ] as const);

    const repository = deriveRepository(
      applicationRepository([
        repositoryMethod({
          operationId: "createWidget",
          name: "createWidget",
          action: "create",
          parameters: [],
          returnTypeExpression: "Widget",
          persistenceKind: "insert",
        }),
        repositoryMethod({
          operationId: "getWidget",
          name: "getWidget",
          action: "get",
          parameters: [],
          returnTypeExpression: "Widget | undefined",
          persistenceKind: "stub",
        }),
      ]),
      tablesBySchema,
      operationsById,
    );

    expect(repository.methods[0]).toMatchObject({
      kind: "insert",
      entityParameterName: "widget",
      identityParameterName: "id",
    });
    expect(repository.methods[1]).toMatchObject({
      kind: "stub",
      entityParameterName: "widget",
      identityParameterName: "id",
    });
  });

  it("when hexagonal classifies a parameterized array GET as list, then drizzle keeps list", () => {
    const operationsById = new Map([["findWidgets", operation("findWidgets", "get")]] as const);

    const repository = deriveRepository(
      applicationRepository([
        repositoryMethod({
          operationId: "findWidgets",
          name: "findWidgets",
          action: "get",
          parameters: [{ name: "status", typeExpression: "string" }],
          returnTypeExpression: "Array<Widget>",
          resultCardinality: "many",
          persistenceKind: "list",
        }),
      ]),
      tablesBySchema,
      operationsById,
    );

    expect(repository.methods[0]?.kind).toBe("list");
  });

  it("when hexagonal publishes persistenceKind, then drizzle uses it instead of re-parsing action", () => {
    const operationsById = new Map([
      ["searchWidgets", operation("searchWidgets", "post")],
    ] as const);

    const repository = deriveRepository(
      applicationRepository([
        repositoryMethod({
          operationId: "searchWidgets",
          name: "searchWidgets",
          action: "search",
          parameters: [],
          returnTypeExpression: "Array<Widget>",
          resultCardinality: "many",
          persistenceKind: "list",
        }),
      ]),
      tablesBySchema,
      operationsById,
    );

    expect(repository.methods[0]?.kind).toBe("list");
  });

  it("when the aggregate has no persisted table, then deriveRepository throws", () => {
    expect(() => deriveRepository(applicationRepository([]), new Map(), new Map())).toThrow(
      'Application repository aggregate "Widget" has no schema with x-hexkit.persistence.',
    );
  });

  it("when a method has no matching contract operation, then deriveRepository throws", () => {
    expect(() =>
      deriveRepository(
        applicationRepository([
          repositoryMethod({
            operationId: "missingOp",
            name: "missingOp",
            action: "create",
            parameters: [],
            returnTypeExpression: "Widget",
          }),
        ]),
        tablesBySchema,
        new Map(),
      ),
    ).toThrow('Application repository method "missingOp" has no matching contract operation.');
  });
});
