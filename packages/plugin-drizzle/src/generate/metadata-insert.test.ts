import { describe, expect, it } from "vite-plus/test";

import type { PersistenceColumnModel } from "../model/column.ts";
import type {
  PersistenceRepositoryMethodModel,
  PersistenceRepositoryModel,
} from "../model/repository.ts";
import {
  isMetadataInsert,
  metadataInsertUsesRandomUuid,
  renderMetadataInsertMethod,
} from "./metadata-insert.ts";

describe("metadata-insert rendering", () => {
  const widgetFk = {
    targetSchemaName: "Widget",
    targetTableExportName: "widgets",
    targetColumnPropertyName: "id",
    targetColumnSqlName: "id",
  };

  function documentTable(
    columns: readonly PersistenceColumnModel[],
  ): PersistenceRepositoryModel["table"] {
    return {
      schemaName: "Document",
      exportName: "documents",
      tableName: "documents",
      identityPropertyName: "id",
      identitySqlName: "id",
      domainFilePath: "src/core/domain/document.ts",
      apicalModulePath: "schemas/Document.ts",
      columns,
    };
  }

  function metadataInsertMethod(
    overrides: Partial<PersistenceRepositoryMethodModel> = {},
  ): PersistenceRepositoryMethodModel {
    return {
      operationId: "uploadDocument",
      name: "uploadDocument",
      kind: "insert",
      usesBlobStore: true,
      parameters: [
        { name: "widgetId", typeExpression: "string", location: "path" },
        { name: "storageKey", typeExpression: "string" },
      ],
      returnTypeExpression: "Document | undefined",
      entityParameterName: "storageKey",
      identityParameterName: "widgetId",
      lookupColumnName: "id",
      ...overrides,
    };
  }

  function repository(
    table: PersistenceRepositoryModel["table"],
    method: PersistenceRepositoryMethodModel,
  ): PersistenceRepositoryModel {
    return {
      aggregate: "Document",
      portName: "DocumentRepository",
      factoryName: "createDrizzleDocumentRepository",
      filePath: "src/adapters/db/document-repository.ts",
      runtimeKey: "documents",
      table,
      methods: [method],
    };
  }

  const validDocumentColumns = [
    {
      propertyName: "id",
      sqlName: "id",
      required: true,
      isIdentity: true,
      sqlType: "text",
    },
    {
      propertyName: "widgetId",
      sqlName: "widget_id",
      required: true,
      isIdentity: false,
      sqlType: "text",
      foreignKey: widgetFk,
    },
    {
      propertyName: "storageKey",
      sqlName: "storage_key",
      required: true,
      isIdentity: false,
      sqlType: "text",
    },
  ] satisfies readonly PersistenceColumnModel[];

  it("when no path parameter targets a foreign key, then renderMetadataInsertMethod throws", () => {
    const method = metadataInsertMethod({
      parameters: [{ name: "storageKey", typeExpression: "string" }],
    });

    expect(() =>
      renderMetadataInsertMethod(repository(documentTable(validDocumentColumns), method), method),
    ).toThrow(
      'Blob upload operation "uploadDocument" requires a path parameter that targets a persisted foreign key on Document.',
    );
  });

  it("when the parent is missing and the return type is required, then the emitted method throws", () => {
    const method = metadataInsertMethod({
      returnTypeExpression: "Document",
    });
    const source = renderMetadataInsertMethod(
      repository(documentTable(validDocumentColumns), method),
      method,
    );

    expect(source).toContain(
      "if (!parent) throw new Error(`Document parent ${widgetId} was not found`);",
    );
    expect(source).toContain(
      'if (!row) throw new Error("Drizzle did not return the inserted document");',
    );
  });

  it("when a parameter has no matching persisted column, then renderMetadataInsertMethod throws", () => {
    const method = metadataInsertMethod({
      parameters: [
        { name: "widgetId", typeExpression: "string", location: "path" },
        { name: "orphanParam", typeExpression: "string" },
      ],
    });

    expect(() =>
      renderMetadataInsertMethod(repository(documentTable(validDocumentColumns), method), method),
    ).toThrow(
      'Blob upload operation "uploadDocument" parameter "orphanParam" has no matching persisted column on Document.',
    );
  });

  it("when the table has no identity column, then renderMetadataInsertMethod throws", () => {
    const table = documentTable([
      {
        propertyName: "widgetId",
        sqlName: "widget_id",
        required: true,
        isIdentity: false,
        sqlType: "text",
        foreignKey: widgetFk,
      },
      {
        propertyName: "storageKey",
        sqlName: "storage_key",
        required: true,
        isIdentity: false,
        sqlType: "text",
      },
    ]);
    const method = metadataInsertMethod();

    expect(() => renderMetadataInsertMethod(repository(table, method), method)).toThrow(
      'Persistence table "Document" has no identity column.',
    );
  });

  it("when the identity column is not text or integer, then renderMetadataInsertMethod throws", () => {
    const table = documentTable([
      {
        propertyName: "id",
        sqlName: "id",
        required: true,
        isIdentity: true,
        sqlType: "boolean",
      },
      {
        propertyName: "widgetId",
        sqlName: "widget_id",
        required: true,
        isIdentity: false,
        sqlType: "text",
        foreignKey: widgetFk,
      },
      {
        propertyName: "storageKey",
        sqlName: "storage_key",
        required: true,
        isIdentity: false,
        sqlType: "text",
      },
    ]);
    const method = metadataInsertMethod();

    expect(() => renderMetadataInsertMethod(repository(table, method), method)).toThrow(
      'Blob upload aggregate "Document" requires a text or integer identity.',
    );
  });

  describe("metadataInsertUsesRandomUuid", () => {
    const repo = repository(documentTable(validDocumentColumns), metadataInsertMethod());

    it("when the method is not a metadata insert, then it returns false", () => {
      const selectMethod = metadataInsertMethod({ kind: "select", usesBlobStore: false });

      expect(isMetadataInsert(selectMethod)).toBe(false);
      expect(metadataInsertUsesRandomUuid(repo, selectMethod)).toBe(false);
    });

    it("when the identity column is integer, then it returns false", () => {
      const integerIdentityTable = documentTable([
        {
          propertyName: "id",
          sqlName: "id",
          required: true,
          isIdentity: true,
          sqlType: "integer",
        },
        ...validDocumentColumns.slice(1),
      ]);
      const method = metadataInsertMethod();
      const integerRepo = repository(integerIdentityTable, method);

      expect(metadataInsertUsesRandomUuid(integerRepo, method)).toBe(false);
    });

    it("when the identity column is text, then it returns true", () => {
      const method = metadataInsertMethod();

      expect(metadataInsertUsesRandomUuid(repo, method)).toBe(true);
    });
  });
});
