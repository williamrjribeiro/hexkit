import { describe, expect, it } from "vite-plus/test";

import type { PersistenceColumnModel } from "../model/column.ts";
import type {
  PersistenceRepositoryMethodModel,
  PersistenceRepositoryModel,
} from "../model/repository.ts";
import type { PersistenceModel } from "../model/derive.ts";
import { renderRepositoryFiles } from "./repository.ts";
import { isFieldPatchUpdate, renderFieldPatchUpdateMethod } from "./field-patch.ts";

const widgetTable = {
  schemaName: "Widget",
  exportName: "widgets",
  tableName: "widgets",
  identityPropertyName: "id",
  identitySqlName: "id",
  domainFilePath: "src/core/domain/widget.ts",
  apicalModulePath: "schemas/Widget.ts",
  columns: [
    {
      propertyName: "id",
      sqlName: "id",
      required: true,
      isIdentity: true,
      sqlType: "text",
    },
    {
      propertyName: "name",
      sqlName: "name",
      required: true,
      isIdentity: false,
      sqlType: "text",
    },
    {
      propertyName: "status",
      sqlName: "status",
      required: true,
      isIdentity: false,
      sqlType: "enum",
      enumExportName: "widgetStatus",
      enumSqlName: "widget_status",
      enumValues: ["active", "inactive"],
    },
  ] satisfies readonly PersistenceColumnModel[],
};

function repository(method: PersistenceRepositoryMethodModel): PersistenceRepositoryModel {
  return {
    aggregate: "Widget",
    portName: "WidgetRepository",
    factoryName: "createDrizzleWidgetRepository",
    filePath: "src/adapters/db/widget-repository.ts",
    runtimeKey: "widgets",
    table: widgetTable,
    methods: [method],
  };
}

function fieldPatchMethod(
  overrides: Partial<PersistenceRepositoryMethodModel> = {},
): PersistenceRepositoryMethodModel {
  return {
    operationId: "updateWidgetWithForm",
    name: "updateWidgetWithForm",
    kind: "update",
    parameters: [
      { name: "widgetId", typeExpression: "string", location: "path" },
      { name: "name", typeExpression: "string | undefined", location: "query" },
      {
        name: "status",
        typeExpression: '"active" | "inactive" | undefined',
        location: "query",
      },
    ],
    returnTypeExpression: "Widget | undefined",
    entityParameterName: "widgetId",
    identityParameterName: "widgetId",
    lookupColumnName: "id",
    ...overrides,
  };
}

describe("Given field-patch update rendering", () => {
  it("when update has path + query params, then it emits a conditional field patch", () => {
    const method = fieldPatchMethod();
    const body = renderFieldPatchUpdateMethod(repository(method), method);

    expect(isFieldPatchUpdate(method)).toBe(true);
    expect(body).toContain("const patch");
    expect(body).toContain("if (name !== undefined) patch.name = name");
    expect(body).toContain("if (status !== undefined) patch.status = status");
    expect(body).toContain(".set(patch)");
    expect(body).toContain("return row ? mapWidgetRow(row) : undefined");
  });

  it("when the patch is empty, then the emitted branch selects by id instead of updating", () => {
    const method = fieldPatchMethod();
    const body = renderFieldPatchUpdateMethod(repository(method), method);

    expect(body).toContain("Object.keys(patch).length === 0");
    expect(body).toMatch(
      /Object\.keys\(patch\)\.length === 0[\s\S]*?\.select\(\)[\s\S]*?return existing \? mapWidgetRow\(existing\) : undefined/,
    );
  });

  it("when a query parameter has no matching non-identity column, then rendering throws", () => {
    const method = fieldPatchMethod({
      parameters: [
        { name: "widgetId", typeExpression: "string", location: "path" },
        { name: "ownerId", typeExpression: "string | undefined", location: "query" },
      ],
    });

    expect(() => renderFieldPatchUpdateMethod(repository(method), method)).toThrow(
      /parameter "ownerId".*no matching persisted column/i,
    );
  });

  it("when update has multiple path parameters, then generation throws instead of entity update", () => {
    const method = fieldPatchMethod({
      parameters: [
        { name: "widgetId", typeExpression: "string", location: "path" },
        { name: "storeId", typeExpression: "string", location: "path" },
        { name: "name", typeExpression: "string | undefined", location: "query" },
      ],
    });

    expect(isFieldPatchUpdate(method)).toBe(false);

    const model: PersistenceModel = {
      applicationSlug: "patch-api",
      migrationPath: "drizzle/0000_patch-api.sql",
      schemaFilePath: "src/adapters/db/schema.ts",
      mapperFilePath: "src/adapters/db/mappers.ts",
      enums: [],
      tables: [widgetTable],
      repositories: [repository(method)],
    };

    expect(() => renderRepositoryFiles(model)).toThrow(
      /exactly one path parameter|multiple path|field-patch/i,
    );
  });

  it("when return type has no undefined, then missing row throws instead of returning undefined", () => {
    const method = fieldPatchMethod({
      returnTypeExpression: "Widget",
    });
    const body = renderFieldPatchUpdateMethod(repository(method), method);

    expect(body).toContain("if (!existing) throw new Error(`Widget ${widgetId} was not found`)");
    expect(body).toContain("if (!row) throw new Error(`Widget ${widgetId} was not found`)");
    expect(body).toContain("return mapWidgetRow(existing)");
    expect(body).toContain("return mapWidgetRow(row)");
    expect(body).not.toMatch(/return (?:existing|row) \? mapWidgetRow/);
  });

  it("when update has a single entity body param without location, then the existing full set path is used", () => {
    const method: PersistenceRepositoryMethodModel = {
      operationId: "updateWidget",
      name: "updateWidget",
      kind: "update",
      parameters: [{ name: "widget", typeExpression: "Widget" }],
      returnTypeExpression: "Widget",
      entityParameterName: "widget",
      identityParameterName: "widget",
      lookupColumnName: "id",
    };

    expect(isFieldPatchUpdate(method)).toBe(false);

    const model: PersistenceModel = {
      applicationSlug: "patch-api",
      migrationPath: "drizzle/0000_patch-api.sql",
      schemaFilePath: "src/adapters/db/schema.ts",
      mapperFilePath: "src/adapters/db/mappers.ts",
      enums: [],
      tables: [widgetTable],
      repositories: [repository(method)],
    };

    const [file] = renderRepositoryFiles(model);
    expect(file?.contents).toContain(".set({ name: widget.name, status: widget.status })");
    expect(file?.contents).not.toContain("const patch");
  });
});
