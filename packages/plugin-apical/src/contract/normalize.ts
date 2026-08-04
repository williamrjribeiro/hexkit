import {
  readOperationExtension,
  readPersistenceExtension,
  readReferenceExtension,
} from "./extensions.ts";
import type { GeneratedApicalModules } from "./generated-index.ts";
import type {
  ContractArtifact,
  ContractHttpMethod,
  ContractMedia,
  ContractOperation,
  ContractParameter,
  ContractParameterLocation,
  ContractProperty,
  ContractRequestBody,
  ContractResponse,
  ContractScalarValue,
  ContractSchema,
  ContractType,
} from "./types.ts";
import {
  asRecord,
  optionalBoolean,
  optionalRecord,
  optionalString,
  requiredString,
} from "./values.ts";

const httpMethods = new Set<ContractHttpMethod>([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
]);

const parameterLocations = new Set<ContractParameterLocation>([
  "cookie",
  "header",
  "path",
  "query",
]);

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-zA-Z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .toLowerCase();

  if (slug.length === 0) {
    throw new Error("OpenAPI info.title must contain at least one letter or number.");
  }

  return slug;
}

function optionalDescription(
  owner: Record<string, unknown>,
  location: string,
): { description?: string } {
  const description = optionalString(owner.description, `${location}.description`);
  return description === undefined ? {} : { description };
}

function decodeJsonPointerSegment(segment: string): string {
  return decodeURIComponent(segment).replaceAll("~1", "/").replaceAll("~0", "~");
}

function resolveLocalReference(
  document: Record<string, unknown>,
  value: unknown,
  location: string,
): Record<string, unknown> {
  let current = asRecord(value, location);
  const visited = new Set<string>();

  while (typeof current.$ref === "string") {
    const reference = current.$ref;
    if (!reference.startsWith("#/")) {
      throw new Error(`${location} contains unresolved external reference "${reference}".`);
    }
    if (visited.has(reference)) {
      throw new Error(`${location} contains a circular reference "${reference}".`);
    }
    visited.add(reference);

    let target: unknown = document;
    for (const encodedSegment of reference.slice(2).split("/")) {
      const segment = decodeJsonPointerSegment(encodedSegment);
      const targetRecord = asRecord(target, `reference "${reference}"`);
      if (!(segment in targetRecord)) {
        throw new Error(`${location} references missing OpenAPI value "${reference}".`);
      }
      target = targetRecord[segment];
    }

    current = asRecord(target, `reference "${reference}"`);
  }

  return current;
}

function readNullableType(
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

function readEnum(value: unknown, location: string): readonly ContractScalarValue[] | undefined {
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

function normalizeProperties(
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

function normalizeParameter(
  document: Record<string, unknown>,
  value: unknown,
  location: string,
): ContractParameter {
  const parameter = resolveLocalReference(document, value, location);
  const rawLocation = requiredString(parameter.in, `${location}.in`);
  if (!parameterLocations.has(rawLocation as ContractParameterLocation)) {
    throw new Error(`${location}.in "${rawLocation}" is not a supported parameter location.`);
  }
  if (parameter.schema === undefined) {
    throw new Error(`${location}.schema is required.`);
  }

  return {
    name: requiredString(parameter.name, `${location}.name`),
    location: rawLocation as ContractParameterLocation,
    required:
      rawLocation === "path" ||
      (optionalBoolean(parameter.required, `${location}.required`) ?? false),
    type: normalizeContractType(parameter.schema, `${location}.schema`),
    ...optionalDescription(parameter, location),
  };
}

function normalizeParameters(
  document: Record<string, unknown>,
  pathItem: Record<string, unknown>,
  operation: Record<string, unknown>,
  location: string,
): readonly ContractParameter[] {
  const pathParameters = pathItem.parameters ?? [];
  const operationParameters = operation.parameters ?? [];
  if (!Array.isArray(pathParameters) || !Array.isArray(operationParameters)) {
    throw new Error(`${location}.parameters must be an array.`);
  }

  const parameters = new Map<string, ContractParameter>();
  for (const [scope, values] of [
    ["path", pathParameters],
    ["operation", operationParameters],
  ] as const) {
    values.forEach((value, index) => {
      const parameter = normalizeParameter(
        document,
        value,
        `${location}.${scope}Parameters[${String(index)}]`,
      );
      parameters.set(`${parameter.location}:${parameter.name}`, parameter);
    });
  }

  return [...parameters.values()];
}

function normalizeMedia(content: unknown, location: string): readonly ContractMedia[] {
  const media = optionalRecord(content, location) ?? {};
  return Object.entries(media).map(([mediaType, value]) => {
    const mediaObject = asRecord(value, `${location}.${mediaType}`);
    return {
      mediaType,
      ...(mediaObject.schema === undefined
        ? {}
        : { type: normalizeContractType(mediaObject.schema, `${location}.${mediaType}.schema`) }),
    };
  });
}

function normalizeRequestBody(
  document: Record<string, unknown>,
  value: unknown,
  location: string,
): ContractRequestBody {
  const requestBody = resolveLocalReference(document, value, location);
  return {
    required: optionalBoolean(requestBody.required, `${location}.required`) ?? false,
    media: normalizeMedia(requestBody.content, `${location}.content`),
    ...optionalDescription(requestBody, location),
  };
}

function normalizeResponses(
  document: Record<string, unknown>,
  value: unknown,
  location: string,
): readonly ContractResponse[] {
  const responses = asRecord(value, location);
  return Object.entries(responses).map(([status, responseValue]) => {
    const response = resolveLocalReference(document, responseValue, `${location}.${status}`);
    return {
      status,
      description: requiredString(response.description, `${location}.${status}.description`),
      media: normalizeMedia(response.content, `${location}.${status}.content`),
    };
  });
}

function normalizeSchemas(
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

function normalizeOperations(
  document: Record<string, unknown>,
  generatedModules: GeneratedApicalModules,
): readonly ContractOperation[] {
  const paths = asRecord(document.paths, "OpenAPI paths");
  const operations: ContractOperation[] = [];

  for (const [path, pathValue] of Object.entries(paths)) {
    const pathItem = resolveLocalReference(document, pathValue, `OpenAPI paths.${path}`);

    for (const [method, operationValue] of Object.entries(pathItem)) {
      if (!httpMethods.has(method as ContractHttpMethod)) continue;

      const location = `OpenAPI paths.${path}.${method}`;
      const operation = asRecord(operationValue, location);
      const operationId = requiredString(operation.operationId, `${location}.operationId`);
      const modulePath = generatedModules.operations.get(operationId);
      if (modulePath === undefined) {
        throw new Error(
          `OpenAPI operation "${operationId}" has no matching entry in Apical routes/index.ts.`,
        );
      }
      if (operation.responses === undefined) {
        throw new Error(`${location}.responses is required.`);
      }

      const requestBody =
        operation.requestBody === undefined
          ? undefined
          : normalizeRequestBody(document, operation.requestBody, `${location}.requestBody`);
      const extension = readOperationExtension(operation, location);
      const summary = optionalString(operation.summary, `${location}.summary`);

      operations.push({
        operationId,
        method: method as ContractHttpMethod,
        path,
        modulePath,
        parameters: normalizeParameters(document, pathItem, operation, location),
        responses: normalizeResponses(document, operation.responses, `${location}.responses`),
        ...(requestBody === undefined ? {} : { requestBody }),
        ...(extension === undefined ? {} : { extension }),
        ...optionalDescription(operation, location),
        ...(summary === undefined ? {} : { summary }),
      });
    }
  }

  return operations;
}

function validateArtifactReferences(artifact: ContractArtifact): void {
  const schemas = new Map(artifact.schemas.map((schema) => [schema.name, schema]));

  const validateType = (type: ContractType, location: string): void => {
    if (type.kind === "reference" && !schemas.has(type.schema)) {
      throw new Error(`${location} references unknown schema "${type.schema}".`);
    }
    if (type.kind === "array") validateType(type.items, `${location}.items`);
    if (type.kind === "object") {
      for (const property of type.properties) {
        validateType(property.type, `${location}.properties.${property.name}`);
      }
    }
  };

  for (const schema of artifact.schemas) {
    if (
      schema.persistence !== undefined &&
      !schema.properties.some((property) => property.name === schema.persistence?.identity)
    ) {
      throw new Error(
        `Schema "${schema.name}" persistence identity "${schema.persistence.identity}" is not a property.`,
      );
    }

    for (const property of schema.properties) {
      validateType(property.type, `Schema "${schema.name}" property "${property.name}"`);
      if (property.reference !== undefined) {
        const target = schemas.get(property.reference.schema);
        if (target === undefined) {
          throw new Error(
            `Schema "${schema.name}" property "${property.name}" references unknown schema "${property.reference.schema}".`,
          );
        }
        if (!target.properties.some(({ name }) => name === property.reference?.property)) {
          throw new Error(
            `Schema "${schema.name}" property "${property.name}" references unknown property "${property.reference.schema}.${property.reference.property}".`,
          );
        }
      }
    }
  }

  for (const operation of artifact.operations) {
    if (operation.extension !== undefined && !schemas.has(operation.extension.aggregate)) {
      throw new Error(
        `Operation "${operation.operationId}" names unknown aggregate "${operation.extension.aggregate}".`,
      );
    }
    for (const parameter of operation.parameters) {
      validateType(
        parameter.type,
        `Operation "${operation.operationId}" parameter "${parameter.name}"`,
      );
    }
    for (const media of operation.requestBody?.media ?? []) {
      if (media.type !== undefined) {
        validateType(media.type, `Operation "${operation.operationId}" request ${media.mediaType}`);
      }
    }
    for (const response of operation.responses) {
      for (const media of response.media) {
        if (media.type !== undefined) {
          validateType(
            media.type,
            `Operation "${operation.operationId}" response ${response.status} ${media.mediaType}`,
          );
        }
      }
    }
  }
}

export function normalizeContractArtifact(
  value: unknown,
  generatedModules: GeneratedApicalModules,
): ContractArtifact {
  const document = asRecord(value, "OpenAPI document");
  const openapiVersion = requiredString(document.openapi, "OpenAPI openapi");
  if (!openapiVersion.startsWith("3.1.")) {
    throw new Error(`Hexkit requires OpenAPI 3.1.x; received "${openapiVersion}".`);
  }

  const info = asRecord(document.info, "OpenAPI info");
  const title = requiredString(info.title, "OpenAPI info.title");
  const version = requiredString(info.version, "OpenAPI info.version");
  const description = optionalString(info.description, "OpenAPI info.description");

  const artifact: ContractArtifact = {
    artifactVersion: 1,
    openapiVersion,
    application: {
      title,
      version,
      slug: slugify(title),
      ...(description === undefined ? {} : { description }),
    },
    schemas: normalizeSchemas(document, generatedModules),
    operations: normalizeOperations(document, generatedModules),
  };

  validateArtifactReferences(artifact);
  return artifact;
}
