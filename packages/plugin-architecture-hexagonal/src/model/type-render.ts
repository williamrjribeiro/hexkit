import type { ContractScalarValue, ContractType } from "@hexkit/plugin-apical";
import { toPascalCase } from "@hexkit/codegen";

export type RenderedType = {
  expression: string;
  referencedSchemas: readonly string[];
  enumAliases: readonly EnumAlias[];
};

export type EnumAlias = {
  name: string;
  values: readonly ContractScalarValue[];
};

export function renderContractType(
  type: ContractType,
  options: { enumTypeName?: string } = {},
): RenderedType {
  const nullableSuffix = type.nullable ? " | null" : "";

  switch (type.kind) {
    case "boolean":
    case "integer":
    case "number":
    case "string": {
      if (type.enum !== undefined && type.enum.length > 0) {
        const aliasName = options.enumTypeName ?? renderEnumUnion(type.enum);
        return {
          expression: `${aliasName}${nullableSuffix}`,
          referencedSchemas: [],
          enumAliases:
            options.enumTypeName === undefined
              ? []
              : [{ name: options.enumTypeName, values: type.enum }],
        };
      }

      const scalar =
        type.kind === "integer" || type.kind === "number"
          ? "number"
          : type.kind === "boolean"
            ? "boolean"
            : "string";
      return {
        expression: `${scalar}${nullableSuffix}`,
        referencedSchemas: [],
        enumAliases: [],
      };
    }
    case "reference":
      return {
        expression: `${type.schema}${nullableSuffix}`,
        referencedSchemas: [type.schema],
        enumAliases: [],
      };
    case "array": {
      const items = renderContractType(type.items);
      return {
        expression: `Array<${items.expression}>${nullableSuffix}`,
        referencedSchemas: items.referencedSchemas,
        enumAliases: items.enumAliases,
      };
    }
    case "object": {
      const lines = type.properties.map((property) => {
        const rendered = renderContractType(property.type, {
          enumTypeName: options.enumTypeName
            ? `${options.enumTypeName}${toPascalCase(property.name)}`
            : undefined,
        });
        const optional = property.required ? "" : "?";
        return {
          line: `  ${property.name}${optional}: ${rendered.expression};`,
          referencedSchemas: rendered.referencedSchemas,
          enumAliases: rendered.enumAliases,
        };
      });

      return {
        expression: `{\n${lines.map((entry) => entry.line).join("\n")}\n}${nullableSuffix}`,
        referencedSchemas: lines.flatMap((entry) => entry.referencedSchemas),
        enumAliases: lines.flatMap((entry) => entry.enumAliases),
      };
    }
  }
}

export function renderEnumUnion(values: readonly ContractScalarValue[]): string {
  return values.map(renderScalarLiteral).join(" | ");
}

export function renderScalarLiteral(value: ContractScalarValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

export function entityEnumAliasName(entityName: string, propertyName: string): string {
  return `${entityName}${toPascalCase(propertyName)}`;
}
