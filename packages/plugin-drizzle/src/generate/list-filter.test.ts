import { describe, expect, it } from "vite-plus/test";

import type { PersistenceColumnModel } from "../model/column.ts";
import type {
  PersistenceRepositoryMethodModel,
  PersistenceRepositoryModel,
} from "../model/repository.ts";
import { findListFilterColumn, renderFilteredListMethodBody } from "./list-filter.ts";

describe("Given filtered list rendering", () => {
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
        propertyName: "status",
        sqlName: "status",
        required: true,
        isIdentity: false,
        sqlType: "enum",
        enumExportName: "widgetStatus",
        enumSqlName: "widget_status",
        enumValues: ["active", "inactive"],
      },
      {
        propertyName: "tags",
        sqlName: "tags",
        required: false,
        isIdentity: false,
        sqlType: "jsonb",
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

  it("when the query parameter maps to an enum column, then inArray is emitted", () => {
    const method: PersistenceRepositoryMethodModel = {
      operationId: "findWidgetsByStatus",
      name: "findWidgetsByStatus",
      kind: "list",
      parameters: [{ name: "status", typeExpression: 'Array<"active" | "inactive">' }],
      returnTypeExpression: "Array<Widget>",
      entityParameterName: "status",
      identityParameterName: "status",
      lookupColumnName: "id",
    };

    const rendered = renderFilteredListMethodBody(repository(method), method);

    expect(rendered.needsInArray).toBe(true);
    expect(rendered.bodyLines.join("\n")).toContain("inArray(widgets.status, status)");
  });

  it("when the query parameter maps to a jsonb column, then a post-select filter is emitted", () => {
    const method: PersistenceRepositoryMethodModel = {
      operationId: "findWidgetsByTags",
      name: "findWidgetsByTags",
      kind: "list",
      parameters: [{ name: "tags", typeExpression: "Array<string>" }],
      returnTypeExpression: "Array<Widget>",
      entityParameterName: "tags",
      identityParameterName: "tags",
      lookupColumnName: "id",
    };

    const rendered = renderFilteredListMethodBody(repository(method), method);

    expect(rendered.needsInArray).toBe(false);
    expect(rendered.bodyLines.join("\n")).toContain(
      "entry.name !== undefined && tags.includes(entry.name)",
    );
  });

  it("when the parameter has no matching column, then rendering throws", () => {
    const method: PersistenceRepositoryMethodModel = {
      operationId: "findWidgetsByOwner",
      name: "findWidgetsByOwner",
      kind: "list",
      parameters: [{ name: "ownerId", typeExpression: "string" }],
      returnTypeExpression: "Array<Widget>",
      entityParameterName: "ownerId",
      identityParameterName: "ownerId",
      lookupColumnName: "id",
    };

    expect(() => renderFilteredListMethodBody(repository(method), method)).toThrow(
      'parameter "ownerId" has no matching persisted column on Widget',
    );
  });

  it("when resolving a filter column by property name, then the column is returned", () => {
    expect(findListFilterColumn(widgetTable.columns, "status")?.sqlType).toBe("enum");
  });
});
