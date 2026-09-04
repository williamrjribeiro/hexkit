import { describe, expect, it } from "vite-plus/test";

import type { PersistenceColumnModel } from "../model/column.ts";
import type {
  PersistenceRepositoryMethodModel,
  PersistenceRepositoryModel,
} from "../model/repository.ts";
import type { PersistenceModel } from "../model/derive.ts";
import { renderRepositoryFiles } from "./repository.ts";

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
      propertyName: "sku",
      sqlName: "sku",
      required: true,
      isIdentity: false,
      sqlType: "text",
    },
    {
      propertyName: "name",
      sqlName: "name",
      required: true,
      isIdentity: false,
      sqlType: "text",
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

function render(method: PersistenceRepositoryMethodModel): string {
  const model: PersistenceModel = {
    applicationSlug: "key-api",
    migrationPath: "drizzle/0000_key-api.sql",
    schemaFilePath: "src/adapters/db/schema.ts",
    mapperFilePath: "src/adapters/db/mappers.ts",
    enums: [],
    tables: [widgetTable],
    repositories: [repository(method)],
  };
  return renderRepositoryFiles(model)[0]?.contents ?? "";
}

describe("Given alternate-key persistence rendering", () => {
  it("when select looks up by a non-identity column, then the where clause uses that column", () => {
    const source = render({
      operationId: "getWidgetBySku",
      name: "getWidgetBySku",
      kind: "select",
      parameters: [{ name: "sku", typeExpression: "string", location: "path" }],
      returnTypeExpression: "Widget | undefined",
      entityParameterName: "sku",
      identityParameterName: "sku",
      lookupColumnName: "sku",
    });

    expect(source).toContain("eq(widgets.sku, sku)");
    expect(source).not.toContain("eq(widgets.id, sku)");
  });

  it("when delete returns boolean, then it reports whether a row was removed", () => {
    const source = render({
      operationId: "deleteWidgetBySku",
      name: "deleteWidgetBySku",
      kind: "delete",
      parameters: [{ name: "sku", typeExpression: "string", location: "path" }],
      returnTypeExpression: "boolean",
      entityParameterName: "sku",
      identityParameterName: "sku",
      lookupColumnName: "sku",
    });

    expect(source).toContain("eq(widgets.sku, sku)");
    expect(source).toContain(".returning()");
    expect(source).toContain("return row !== undefined");
  });

  it("when update has a path key and entity body, then set uses the entity and where uses the path", () => {
    const source = render({
      operationId: "updateWidgetBySku",
      name: "updateWidgetBySku",
      kind: "update",
      parameters: [
        { name: "sku", typeExpression: "string", location: "path" },
        { name: "widget", typeExpression: "Widget" },
      ],
      returnTypeExpression: "Widget",
      entityParameterName: "widget",
      identityParameterName: "sku",
      lookupColumnName: "sku",
    });

    expect(source).toContain(".set({ sku: widget.sku, name: widget.name })");
    expect(source).toContain("eq(widgets.sku, sku)");
    expect(source).not.toContain("eq(widgets.id, widget.id)");
  });

  it("when insert receives an array body, then values uses the array and returns the first row", () => {
    const source = render({
      operationId: "createWidgets",
      name: "createWidgets",
      kind: "insert",
      parameters: [{ name: "body", typeExpression: "Array<Widget>" }],
      returnTypeExpression: "Widget",
      entityParameterName: "body",
      identityParameterName: "body",
      lookupColumnName: "id",
    });

    expect(source).toContain(".values(body).returning()");
    expect(source).toContain("const [row] = rows");
    expect(source).toContain("return mapWidgetRow(row)");
  });

  it("when a stub returns void, then the method returns without a value", () => {
    const source = render({
      operationId: "logoutWidgets",
      name: "logoutWidgets",
      kind: "stub",
      parameters: [],
      returnTypeExpression: "void",
      entityParameterName: "widget",
      identityParameterName: "id",
      lookupColumnName: "id",
    });

    expect(source).toContain("return;");
    expect(source).not.toContain("return { ok: true }");
  });

  it("when a stub returns string, then the method returns an empty string", () => {
    const source = render({
      operationId: "issueWidgetToken",
      name: "issueWidgetToken",
      kind: "stub",
      parameters: [{ name: "label", typeExpression: "string", location: "query" }],
      returnTypeExpression: "string",
      entityParameterName: "label",
      identityParameterName: "label",
      lookupColumnName: "id",
    });

    expect(source).toContain('return ""');
    expect(source).not.toContain("return { ok: true }");
  });
});
