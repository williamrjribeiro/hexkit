import { describe, expect, it } from "vite-plus/test";

import type { ContractArtifact, ContractOperation } from "./types.ts";
import { validateArtifactReferences, validateEnforceableSecurity } from "./validate-artifact.ts";

function artifact(overrides: Partial<ContractArtifact> = {}): ContractArtifact {
  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: { title: "Library", version: "1.0.0", slug: "library" },
    schemas: [
      {
        name: "Book",
        modulePath: "schemas/Book.ts",
        properties: [{ name: "id", required: true, type: { kind: "string", nullable: false } }],
      },
    ],
    securitySchemes: [],
    globalSecurity: [],
    operations: [],
    ...overrides,
  };
}

describe("Given artifact references", () => {
  it("when persistence identity is missing, then validation fails", () => {
    expect(() =>
      validateArtifactReferences(
        artifact({
          schemas: [
            {
              name: "Book",
              modulePath: "schemas/Book.ts",
              properties: [
                { name: "id", required: true, type: { kind: "string", nullable: false } },
              ],
              persistence: { table: "books", identity: "missing" },
            },
          ],
        }),
      ),
    ).toThrow('Schema "Book" persistence identity "missing" is not a property.');
  });

  it("when a property references an unknown schema, then validation fails", () => {
    expect(() =>
      validateArtifactReferences(
        artifact({
          schemas: [
            {
              name: "Book",
              modulePath: "schemas/Book.ts",
              properties: [
                {
                  name: "authorId",
                  required: false,
                  type: { kind: "string", nullable: false },
                  reference: { schema: "Author", property: "id" },
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow('Schema "Book" property "authorId" references unknown schema "Author".');
  });

  it("when a property references an unknown target property, then validation fails", () => {
    expect(() =>
      validateArtifactReferences(
        artifact({
          schemas: [
            {
              name: "Book",
              modulePath: "schemas/Book.ts",
              properties: [
                { name: "id", required: true, type: { kind: "string", nullable: false } },
                {
                  name: "authorId",
                  required: false,
                  type: { kind: "string", nullable: false },
                  reference: { schema: "Book", property: "missing" },
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow('Schema "Book" property "authorId" references unknown property "Book.missing".');
  });

  it("when a type $ref names an unknown schema, then validation fails", () => {
    expect(() =>
      validateArtifactReferences(
        artifact({
          schemas: [
            {
              name: "Book",
              modulePath: "schemas/Book.ts",
              properties: [
                {
                  name: "authorId",
                  required: false,
                  type: { kind: "reference", nullable: false, schema: "Missing" },
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow('Schema "Book" property "authorId" references unknown schema "Missing".');
  });

  it("when an operation names an unknown aggregate, then validation fails", () => {
    expect(() =>
      validateArtifactReferences(
        artifact({
          operations: [
            {
              operationId: "getBook",
              method: "get",
              path: "/books/{id}",
              modulePath: "routes/getBook.ts",
              parameters: [],
              responses: [],
              security: { overridesGlobal: false, requirements: [], apicalServerHeaderNames: [] },
              extension: { aggregate: "Missing", action: "read" },
            },
          ],
        }),
      ),
    ).toThrow('Operation "getBook" names unknown aggregate "Missing".');
  });
});

describe("Given operation security enforceability", () => {
  it("when a requirement ANDs multiple schemes, then validation fails", () => {
    expect(() =>
      validateEnforceableSecurity(
        "listItems",
        {
          overridesGlobal: true,
          requirements: [{ schemes: ["bearerAuth", "implicitOAuth"], scopes: {} }],
          apicalServerHeaderNames: [],
        },
        [
          { name: "bearerAuth", type: "http", scheme: "bearer", headerName: "Authorization" },
          {
            name: "implicitOAuth",
            type: "unsupported",
            openApiType: "oauth2",
            reason: "unsupported",
          },
        ],
      ),
    ).toThrow(/AND of multiple security schemes/);
  });

  it("when only unsupported schemes remain, then validation names them", () => {
    expect(() =>
      validateEnforceableSecurity(
        "getBook",
        {
          overridesGlobal: true,
          requirements: [{ schemes: ["oauth"], scopes: { oauth: ["read"] } }],
          apicalServerHeaderNames: [],
        },
        [{ name: "oauth", type: "unsupported", openApiType: "oauth2", reason: "unsupported" }],
      ),
    ).toThrow(/cannot enforce at runtime: oauth \(oauth2\)/);
  });

  it("when a scheme is unknown, then validation reports unknown", () => {
    expect(() =>
      validateEnforceableSecurity(
        "getBook",
        {
          overridesGlobal: true,
          requirements: [{ schemes: ["missing"], scopes: { missing: [] } }],
          apicalServerHeaderNames: [],
        },
        [],
      ),
    ).toThrow(/missing \(unknown\)/);
  });

  it("when requirements are empty, then validation succeeds", () => {
    expect(() =>
      validateEnforceableSecurity(
        "getHealth",
        { overridesGlobal: true, requirements: [], apicalServerHeaderNames: [] },
        [],
      ),
    ).not.toThrow();
  });
});

describe("Given nested contract types on operations", () => {
  it("when parameter, request, and response types are valid, then nested arrays and objects are walked", () => {
    expect(() =>
      validateArtifactReferences(
        artifact({
          operations: [
            {
              operationId: "getBook",
              method: "get",
              path: "/books",
              modulePath: "routes/getBook.ts",
              parameters: [
                {
                  name: "q",
                  location: "query",
                  required: false,
                  type: {
                    kind: "array",
                    nullable: false,
                    items: { kind: "string", nullable: false },
                  },
                },
              ],
              requestBody: {
                required: false,
                media: [
                  {
                    mediaType: "application/json",
                    type: {
                      kind: "object",
                      nullable: false,
                      properties: [
                        {
                          name: "note",
                          required: false,
                          type: { kind: "string", nullable: false },
                        },
                      ],
                    },
                  },
                  { mediaType: "text/plain" },
                ],
              },
              responses: [
                {
                  status: "200",
                  description: "ok",
                  media: [
                    {
                      mediaType: "application/json",
                      type: { kind: "reference", nullable: false, schema: "Book" },
                    },
                  ],
                },
              ],
              security: { overridesGlobal: false, requirements: [], apicalServerHeaderNames: [] },
            },
          ],
        }),
      ),
    ).not.toThrow();
  });
});

describe("Given group-by operations", () => {
  function groupByOperation(overrides: Partial<ContractOperation> = {}): ContractOperation {
    return {
      operationId: "getInventory",
      method: "get",
      path: "/inventory",
      modulePath: "routes/getInventory.ts",
      parameters: [],
      responses: [
        {
          status: "200",
          description: "Inventory by status",
          media: [
            {
              mediaType: "application/json",
              type: {
                kind: "object",
                nullable: false,
                properties: [],
                additionalProperties: { kind: "integer", nullable: false, format: "int32" },
              },
            },
          ],
        },
      ],
      security: { overridesGlobal: false, requirements: [], apicalServerHeaderNames: [] },
      extension: { aggregate: "Book", action: "read", groupBy: "status" },
      ...overrides,
    };
  }

  it("when a group-by read returns an integer map, then validation succeeds", () => {
    expect(() =>
      validateArtifactReferences(artifact({ operations: [groupByOperation()] })),
    ).not.toThrow();
  });

  it("when a group-by read has parameters, then validation fails", () => {
    expect(() =>
      validateArtifactReferences(
        artifact({
          operations: [
            groupByOperation({
              parameters: [
                {
                  name: "status",
                  location: "query",
                  required: false,
                  type: { kind: "string", nullable: false },
                },
              ],
            }),
          ],
        }),
      ),
    ).toThrow(
      'Operation "getInventory" x-hexkit.operation.groupBy does not support parameters; group-count reads cannot filter.',
    );
  });

  it("when a group-by read has no 2xx JSON map response, then validation fails", () => {
    expect(() =>
      validateArtifactReferences(artifact({ operations: [groupByOperation({ responses: [] })] })),
    ).toThrow(
      'Operation "getInventory" x-hexkit.operation.groupBy requires a 2xx application/json response typed as an object with additionalProperties.',
    );
  });

  it("when a group-by map has non-integer values, then validation fails", () => {
    expect(() =>
      validateArtifactReferences(
        artifact({
          operations: [
            groupByOperation({
              responses: [
                {
                  status: "200",
                  description: "Inventory by status",
                  media: [
                    {
                      mediaType: "application/json",
                      type: {
                        kind: "object",
                        nullable: false,
                        properties: [],
                        additionalProperties: { kind: "string", nullable: false },
                      },
                    },
                  ],
                },
              ],
            }),
          ],
        }),
      ),
    ).toThrow(
      'Operation "getInventory" x-hexkit.operation.groupBy requires an integer additionalProperties (got "string").',
    );
  });

  it("when a map value references an unknown schema, then validation fails", () => {
    expect(() =>
      validateArtifactReferences(
        artifact({
          schemas: [
            {
              name: "Book",
              modulePath: "schemas/Book.ts",
              properties: [
                {
                  name: "counts",
                  required: false,
                  type: {
                    kind: "object",
                    nullable: false,
                    properties: [],
                    additionalProperties: { kind: "reference", nullable: false, schema: "Missing" },
                  },
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow('references unknown schema "Missing".');
  });
});
