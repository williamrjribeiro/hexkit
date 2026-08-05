export type ContractApplication = {
  title: string;
  version: string;
  slug: string;
  description?: string;
};

export type ContractScalarValue = string | number | boolean | null;

export type ContractScalarType = {
  kind: "boolean" | "integer" | "number" | "string";
  nullable: boolean;
  format?: string;
  enum?: readonly ContractScalarValue[];
};

export type ContractArrayType = {
  kind: "array";
  nullable: boolean;
  items: ContractType;
};

export type ContractReferenceType = {
  kind: "reference";
  nullable: boolean;
  schema: string;
};

export type ContractObjectType = {
  kind: "object";
  nullable: boolean;
  properties: readonly ContractProperty[];
};

export type ContractType =
  | ContractArrayType
  | ContractObjectType
  | ContractReferenceType
  | ContractScalarType;

export type ContractReferenceExtension = {
  schema: string;
  property: string;
};

export type ContractProperty = {
  name: string;
  required: boolean;
  type: ContractType;
  description?: string;
  reference?: ContractReferenceExtension;
};

export type ContractPersistenceExtension = {
  table: string;
  identity: string;
};

export type ContractSchema = {
  name: string;
  modulePath: string;
  properties: readonly ContractProperty[];
  description?: string;
  persistence?: ContractPersistenceExtension;
};

export type ContractParameterLocation = "cookie" | "header" | "path" | "query";

export type ContractParameter = {
  name: string;
  location: ContractParameterLocation;
  required: boolean;
  type: ContractType;
  description?: string;
};

export type ContractMedia = {
  mediaType: string;
  type?: ContractType;
};

export type ContractRequestBody = {
  required: boolean;
  media: readonly ContractMedia[];
  description?: string;
};

export type ContractResponse = {
  status: string;
  description: string;
  media: readonly ContractMedia[];
};

export type ContractOperationExtension = {
  aggregate: string;
  action: string;
};

export type ContractSecurityScheme =
  | { name: string; type: "apiKey"; in: "header"; headerName: string }
  | {
      name: string;
      type: "http";
      scheme: "bearer";
      headerName: "Authorization";
      bearerFormat?: string;
    }
  | { name: string; type: "unsupported"; openApiType: string; reason: string };

export type ContractSecurityRequirement = {
  schemes: readonly string[];
  scopes: Readonly<Record<string, readonly string[]>>;
};

export type ContractOperationSecurity = {
  overridesGlobal: boolean;
  requirements: readonly ContractSecurityRequirement[];
  apicalServerHeaderNames: readonly string[];
};

export type ContractHttpMethod =
  | "delete"
  | "get"
  | "head"
  | "options"
  | "patch"
  | "post"
  | "put"
  | "trace";

export type ContractOperation = {
  operationId: string;
  method: ContractHttpMethod;
  path: string;
  modulePath: string;
  parameters: readonly ContractParameter[];
  responses: readonly ContractResponse[];
  security: ContractOperationSecurity;
  requestBody?: ContractRequestBody;
  extension?: ContractOperationExtension;
  summary?: string;
  description?: string;
};

export type ContractArtifact = {
  artifactVersion: 1;
  openapiVersion: string;
  application: ContractApplication;
  schemas: readonly ContractSchema[];
  securitySchemes: readonly ContractSecurityScheme[];
  globalSecurity: readonly ContractSecurityRequirement[];
  operations: readonly ContractOperation[];
};
