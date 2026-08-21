import { readPersistenceExtension, readReferenceExtension } from "./extensions.ts";
import type { GeneratedApicalModules } from "./generated-index.ts";
import { decodeJsonPointerSegment } from "./json-pointer.ts";
import type {
  ContractProperty,
  ContractScalarValue,
  ContractSchema,
  ContractType,
} from "./types.ts";
import {
  asRecord,
  optionalBoolean,
  optionalDescription,
  optionalRecord,
  optionalString,
  requiredString,
} from "./values.ts";

export function readNullableType(
  schema: Record<string, unknown>,
  location: string,
): { nullable: boolean; type: string } {
  const legacyNullable = optionalBoolean(schema.nullable, `${location}.nullable`) ?? false;
  const rawType = schema.type;

  if (typeof rawType === "string") {
    return { nullable: legacyNullable || rawType === "null", type: rawType };
  }

  if (Array.isArray(rawType)) {
    const types = rawType.map((type, index) =>
      requiredString(type, `${location}.type[${String(index)}]`),
    );
    const nonNullTypes = types.filter((type) => type !== "null");
    if (nonNullTypes.length !== 1 || types.length > 2) {
      throw new Error(
        `${location}.type must contain exactly one non-null type and optional "null".`,
      );
    }

    return { nullable: legacyNullable || types.includes("null"), type: nonNullTypes[0] };
  }

  throw new Error(`${location}.type must be a string or a nullable two-item string array.`);
}

export function readEnum(
  value: unknown,
  location: string,
): readonly ContractScalarValue[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${location} must be a non-empty array.`);
  }

  return value.map((entry, index) => {
    if (
      entry !== null &&
      typeof entry !== "string" &&
      typeof entry !== "number" &&
      typeof entry !== "boolean"
    ) {
      throw new Error(`${location}[${String(index)}] must be a scalar JSON value.`);
    }
    return entry;
  });
}

function schemaReferenceName(reference: string, location: string): string {
  const prefix = "#/components/schemas/";
  if (!reference.startsWith(prefix)) {
    throw new Error(
      `${location} uses reference "${reference}"; contract types may only reference component schemas.`,
    );
  }

  return requiredString(
    decodeJsonPointerSegment(reference.slice(prefix.length)),
    `${location}.$ref`,
  );
}

export function normalizeProperties(
  schema: Record<string, unknown>,
  location: string,
): readonly ContractProperty[] {
  const properties = optionalRecord(schema.properties, `${location}.properties`) ?? {};
  const requiredValue = schema.required;
  if (requiredValue !== undefined && !Array.isArray(requiredValue)) {
    throw new Error(`${location}.required must be an array of property names.`);
  }

  const required = new Set(
    (requiredValue ?? []).map((name, index) =>
      requiredString(name, `${location}.required[${String(index)}]`),
    ),
  );

  for (const requiredName of required) {
    if (!(requiredName in properties)) {
      throw new Error(`${location}.required references missing property "${requiredName}".`);
    }
  }

  return Object.entries(properties).map(([name, value]) => {
    const propertyLocation = `${location}.properties.${name}`;
    const property = asRecord(value, propertyLocation);
    const reference = readReferenceExtension(property, propertyLocation);

    return {
      name,
      required: required.has(name),
      type: normalizeContractType(property, propertyLocation),
      ...optionalDescription(property, propertyLocation),
      ...(reference === undefined ? {} : { reference }),
    };
  });
}

export function normalizeContractType(value: unknown, location: string): ContractType {
  const schema = asRecord(value, location);

  if (typeof schema.$ref === "string") {
    const nullable = optionalBoolean(schema.nullable, `${location}.nullable`) ?? false;
    return {
      kind: "reference",
      nullable,
      schema: schemaReferenceName(schema.$ref, location),
    };
  }

  for (const unsupportedKeyword of ["allOf", "anyOf", "not", "oneOf"] as const) {
    if (schema[unsupportedKeyword] !== undefined) {
      throw new Error(`${location}.${unsupportedKeyword} is not supported by ContractArtifact.`);
    }
  }

  const normalizedType = readNullableType(schema, location);
  if (normalizedType.type === "null") {
    throw new Error(`${location} cannot declare only the null type.`);
  }

  if (normalizedType.type === "array") {
    if (schema.items === undefined) {
      throw new Error(`${location}.items is required for array types.`);
    }
    return {
      kind: "array",
      nullable: normalizedType.nullable,
      items: normalizeContractType(schema.items, `${location}.items`),
    };
  }

  if (normalizedType.type === "object") {
    return {
      kind: "object",
      nullable: normalizedType.nullable,
      properties: normalizeProperties(schema, location),
    };
  }

  if (
    normalizedType.type !== "boolean" &&
    normalizedType.type !== "integer" &&
    normalizedType.type !== "number" &&
    normalizedType.type !== "string"
  ) {
    throw new Error(`${location}.type "${normalizedType.type}" is not supported.`);
  }

  const format = optionalString(schema.format, `${location}.format`);
  const enumeration = readEnum(schema.enum, `${location}.enum`);
  return {
    kind: normalizedType.type,
    nullable: normalizedType.nullable,
    ...(format === undefined ? {} : { format }),
    ...(enumeration === undefined ? {} : { enum: enumeration }),
  };
}

export function normalizeSchemas(
  document: Record<string, unknown>,
  generatedModules: GeneratedApicalModules,
): readonly ContractSchema[] {
  const components = optionalRecord(document.components, "OpenAPI components") ?? {};
  const schemas = optionalRecord(components.schemas, "OpenAPI components.schemas") ?? {};

  return Object.entries(schemas).map(([name, value]) => {
    const location = `OpenAPI components.schemas.${name}`;
    const schema = asRecord(value, location);
    const normalizedType = readNullableType(schema, location);
    if (normalizedType.type !== "object") {
      throw new Error(`${location} must be an object schema.`);
    }

    const modulePath = generatedModules.schemas.get(name);
    if (modulePath === undefined) {
      throw new Error(
        `OpenAPI schema "${name}" has no matching export in Apical schemas/index.ts.`,
      );
    }

    const persistence = readPersistenceExtension(schema, location);
    return {
      name,
      modulePath,
      properties: normalizeProperties(schema, location),
      ...optionalDescription(schema, location),
      ...(persistence === undefined ? {} : { persistence }),
    };
  });
}
