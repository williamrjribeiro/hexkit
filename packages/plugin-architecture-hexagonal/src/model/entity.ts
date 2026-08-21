import { toKebabCase, unique } from "@hexkit/codegen";
import type { ContractSchema } from "@hexkit/plugin-apical";

import { entityEnumAliasName, renderContractType, type EnumAlias } from "./type-render.ts";

export type DomainEntityModel = {
  name: string;
  filePath: string;
  exportName: string;
  enumAliases: readonly EnumAlias[];
  properties: readonly {
    name: string;
    required: boolean;
    typeExpression: string;
  }[];
  referencedSchemas: readonly string[];
};

export function deriveDomainEntity(schema: ContractSchema): DomainEntityModel {
  const properties = schema.properties.map((property) => {
    const rendered = renderContractType(property.type, {
      enumTypeName: entityEnumAliasName(schema.name, property.name),
    });
    return {
      name: property.name,
      required: property.required,
      typeExpression: rendered.expression,
      enumAliases: rendered.enumAliases,
      referencedSchemas: rendered.referencedSchemas,
    };
  });

  return {
    name: schema.name,
    exportName: schema.name,
    filePath: `src/core/domain/${toKebabCase(schema.name)}.ts`,
    enumAliases: properties.flatMap((property) => property.enumAliases),
    properties: properties.map(({ name, required, typeExpression }) => ({
      name,
      required,
      typeExpression,
    })),
    referencedSchemas: unique(
      properties
        .flatMap((property) => property.referencedSchemas)
        .filter((name) => name !== schema.name),
    ),
  };
}
