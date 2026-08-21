import { toCamelCase, toPascalCase, toSnakeCase } from "@hexkit/codegen";
import type {
  ContractProperty,
  ContractReferenceExtension,
  ContractScalarValue,
  ContractSchema,
} from "@hexkit/plugin-apical";

/**
 * Postgres column type for one persisted OpenAPI property.
 *
 * Nested objects, arrays, and `$ref` values use `jsonb` (Postgres JSONB, not
 * `json`). Scalar foreign keys keep a matching scalar type such as `integer`
 * or `text`.
 */
export type PersistenceColumnSqlType = "boolean" | "enum" | "integer" | "jsonb" | "text";

export type PersistenceEnumModel = {
  exportName: string;
  sqlName: string;
  values: readonly string[];
};

export type PersistenceForeignKeyModel = {
  targetSchemaName: string;
  targetTableExportName: string;
  targetColumnPropertyName: string;
  targetColumnSqlName: string;
};

type PersistenceColumnBase = {
  propertyName: string;
  sqlName: string;
  required: boolean;
  isIdentity: boolean;
  foreignKey?: PersistenceForeignKeyModel;
};

/**
 * One column on a generated persistence table.
 *
 * `sqlType` is `jsonb` when the OpenAPI property is a nested object, array, or
 * `$ref`. `foreignKey` is set only for scalar `x-hexkit.reference` properties.
 * Enum columns always carry enum metadata; other sqlTypes never do.
 */
export type PersistenceColumnModel =
  | (PersistenceColumnBase & {
      sqlType: "boolean" | "integer" | "text" | "jsonb";
    })
  | (PersistenceColumnBase & {
      sqlType: "enum";
      enumExportName: string;
      enumSqlName: string;
      enumValues: readonly string[];
    });

export type PersistenceColumnWithForeignKey = PersistenceColumnModel & {
  foreignKey: PersistenceForeignKeyModel;
};

type ResolvedColumnType =
  | { sqlType: "boolean" | "integer" | "text" | "jsonb" }
  | {
      sqlType: "enum";
      enumExportName: string;
      enumSqlName: string;
      enumValues: readonly string[];
    };

/**
 * Assembles one persistence column from a contract property.
 *
 * Nested object, array, and `$ref` properties cannot also declare
 * `x-hexkit.reference`; use a scalar foreign-key property instead.
 */
export function deriveColumn(
  schemaName: string,
  property: ContractProperty,
  identity: string,
  schemasByName: ReadonlyMap<string, ContractSchema>,
): PersistenceColumnModel {
  if (property.reference !== undefined) {
    if (
      property.type.kind === "reference" ||
      property.type.kind === "object" ||
      property.type.kind === "array"
    ) {
      const structuredType = property.type.kind === "reference" ? "$ref" : property.type.kind;
      throw new Error(
        `Schema "${schemaName}" property "${property.name}" cannot combine ${structuredType} with x-hexkit.reference. Use a scalar FK property, or omit x-hexkit.reference to store JSONB.`,
      );
    }
  }

  const columnType = resolveColumnType(schemaName, property);
  const foreignKey =
    property.reference === undefined
      ? undefined
      : deriveForeignKey(schemaName, property, property.reference, schemasByName);

  const base: PersistenceColumnBase = {
    propertyName: property.name,
    sqlName: toSnakeCase(property.name),
    required: property.required && !property.type.nullable,
    isIdentity: property.name === identity,
    ...(foreignKey === undefined ? {} : { foreignKey }),
  };

  if (columnType.sqlType === "enum") {
    return {
      ...base,
      sqlType: "enum",
      enumExportName: columnType.enumExportName,
      enumSqlName: columnType.enumSqlName,
      enumValues: columnType.enumValues,
    };
  }

  return {
    ...base,
    sqlType: columnType.sqlType,
  };
}

export function columnsWithForeignKeys(
  columns: readonly PersistenceColumnModel[],
): readonly PersistenceColumnWithForeignKey[] {
  return columns.filter(
    (column): column is PersistenceColumnWithForeignKey => column.foreignKey !== undefined,
  );
}

function deriveForeignKey(
  schemaName: string,
  property: ContractProperty,
  reference: ContractReferenceExtension,
  schemasByName: ReadonlyMap<string, ContractSchema>,
): PersistenceForeignKeyModel {
  const target = schemasByName.get(reference.schema);
  if (target === undefined) {
    throw new Error(
      `Schema "${schemaName}" property "${property.name}" references unknown schema "${reference.schema}".`,
    );
  }
  if (target.persistence === undefined) {
    throw new Error(
      `Schema "${schemaName}" property "${property.name}" references "${reference.schema}" which has no x-hexkit.persistence.`,
    );
  }

  return {
    targetSchemaName: reference.schema,
    targetTableExportName: target.persistence.table,
    targetColumnPropertyName: reference.property,
    targetColumnSqlName: toSnakeCase(reference.property),
  };
}

function resolveColumnType(schemaName: string, property: ContractProperty): ResolvedColumnType {
  const type = property.type;
  switch (type.kind) {
    case "boolean":
      return { sqlType: "boolean" };
    case "integer":
      return { sqlType: "integer" };
    case "number":
      throw new Error(
        `Schema "${schemaName}" property "${property.name}" uses number, which is not supported for Drizzle persistence yet.`,
      );
    case "string": {
      if (type.enum !== undefined && type.enum.length > 0) {
        const sqlName = toSnakeCase(`${schemaName}_${property.name}`);
        return {
          sqlType: "enum",
          enumExportName: toCamelCase(`${schemaName}${toPascalCase(property.name)}`),
          enumSqlName: sqlName,
          enumValues: type.enum.map((value) =>
            requireStringEnumValue(value, `Schema "${schemaName}" property "${property.name}"`),
          ),
        };
      }
      return { sqlType: "text" };
    }
    case "reference":
    case "array":
    case "object":
      return { sqlType: "jsonb" };
  }
}

function requireStringEnumValue(value: ContractScalarValue, location: string): string {
  if (typeof value !== "string") {
    throw new Error(`${location} enum values must be strings for Postgres enums.`);
  }
  return value;
}
