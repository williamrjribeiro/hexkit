import { describe, expect, it } from "vite-plus/test";

import {
  inspectGeneratedIndexes,
  inspectRoutesIndex,
  inspectSchemaIndex,
} from "./generated-index.ts";
import { normalizeContractArtifact, normalizeContractType } from "./normalize.ts";

const generatedModules = {
  schemas: new Map([["Book", "schemas/Book.ts"]]),
  operations: new Map([["getBook", "routes/getBook.ts"]]),
};

function createDocument(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Library API",
      version: "2.0.0",
      description: "Books and shelves",
    },
    paths: {
      "/books/{bookId}": {
        get: {
          operationId: "getBook",
          summary: "Get a book",
          description: "Fetch one book by id",
          "x-hexkit": {
            operation: {
              aggregate: "Book",
              action: "read",
            },
          },
          parameters: [
            {
              name: "bookId",
              in: "path",
              required: true,
              schema: { type: "integer", format: "int32" },
            },
            {
              name: "verbose",
              in: "query",
              schema: { type: "boolean" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    note: { type: "string", enum: ["a", "b", null, true, 1] },
                  },
                },
              },
              "text/plain": {},
            },
          },
          responses: {
            "200": {
              description: "Book found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Book" },
                },
              },
            },
            "204": {
              description: "No content",
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Book: {
          type: "object",
          description: "A book",
          required: ["id", "title"],
          "x-hexkit": {
            persistence: {
              table: "books",
              identity: "id",
            },
          },
          properties: {
            id: { type: "integer", format: "int32" },
            title: { type: ["string", "null"] },
            tags: {
              type: "array",
              nullable: true,
              items: { type: "string" },
            },
            authorId: {
              type: "string",
              "x-hexkit": {
                reference: {
                  schema: "Book",
                  property: "id",
                },
              },
            },
          },
        },
      },
      parameters: {
        SharedLimit: {
          name: "limit",
          in: "query",
          schema: { type: "integer" },
        },
      },
      requestBodies: {
        NoteBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { text: { type: "string" } } },
            },
          },
        },
      },
      responses: {
        NotFound: {
          description: "Missing",
          content: {
            "application/json": {
              schema: { type: "object", properties: { message: { type: "string" } } },
            },
          },
        },
      },
    },
  };
}

describe("normalizeContractArtifact", () => {
  it("normalizes application, schema, operation, media, and extension metadata", () => {
    const artifact = normalizeContractArtifact(createDocument(), generatedModules);

    expect(artifact).toMatchObject({
      artifactVersion: 1,
      openapiVersion: "3.1.0",
      application: {
        title: "Library API",
        version: "2.0.0",
        slug: "library-api",
        description: "Books and shelves",
      },
      schemas: [
        {
          name: "Book",
          modulePath: "schemas/Book.ts",
          description: "A book",
          persistence: {
            table: "books",
            identity: "id",
          },
          properties: [
            {
              name: "id",
              required: true,
              type: { kind: "integer", nullable: false, format: "int32" },
            },
            {
              name: "title",
              required: true,
              type: { kind: "string", nullable: true },
            },
            {
              name: "tags",
              required: false,
              type: {
                kind: "array",
                nullable: true,
                items: { kind: "string", nullable: false },
              },
            },
            {
              name: "authorId",
              required: false,
              reference: { schema: "Book", property: "id" },
              type: { kind: "string", nullable: false },
            },
          ],
        },
      ],
      operations: [
        {
          operationId: "getBook",
          method: "get",
          path: "/books/{bookId}",
          modulePath: "routes/getBook.ts",
          summary: "Get a book",
          description: "Fetch one book by id",
          extension: {
            aggregate: "Book",
            action: "read",
          },
          requestBody: {
            required: false,
            media: expect.arrayContaining([expect.objectContaining({ mediaType: "text/plain" })]),
          },
          responses: expect.arrayContaining([
            {
              status: "200",
              description: "Book found",
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "reference", nullable: false, schema: "Book" },
                },
              ],
            },
            {
              status: "204",
              description: "No content",
              media: [],
            },
          ]),
        },
      ],
    });
  });

  it("rejects malformed Hexkit extensions instead of guessing", () => {
    const document = createDocument();
    const components = document.components as {
      schemas: { Book: Record<string, unknown> };
    };
    components.schemas.Book["x-hexkit"] = {
      persistence: {
        table: "books",
      },
    };

    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      "OpenAPI components.schemas.Book.x-hexkit.persistence.identity must be a non-empty string.",
    );
  });

  it("rejects unsupported union types explicitly", () => {
    expect(() =>
      normalizeContractType({ oneOf: [{ type: "string" }, { type: "integer" }] }, "test schema"),
    ).toThrow("test schema.oneOf is not supported by ContractArtifact.");
  });

  it("fails when OpenAPI schemas or operations do not match Apical modules", () => {
    expect(() =>
      normalizeContractArtifact(createDocument(), {
        schemas: new Map(),
        operations: generatedModules.operations,
      }),
    ).toThrow('OpenAPI schema "Book" has no matching export in Apical schemas/index.ts.');

    expect(() =>
      normalizeContractArtifact(createDocument(), {
        schemas: generatedModules.schemas,
        operations: new Map(),
      }),
    ).toThrow('OpenAPI operation "getBook" has no matching entry in Apical routes/index.ts.');
  });

  it("slugifies titles and rejects titles without alphanumeric characters", () => {
    const document = createDocument();
    (document.info as { title: string }).title = "Café Books!";
    expect(normalizeContractArtifact(document, generatedModules).application.slug).toBe(
      "cafe-books",
    );

    (document.info as { title: string }).title = "!!!";
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      "OpenAPI info.title must contain at least one letter or number.",
    );
  });

  it("rejects OpenAPI versions outside 3.1.x", () => {
    const document = createDocument();
    document.openapi = "3.0.3";
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      'Hexkit requires OpenAPI 3.1.x; received "3.0.3".',
    );
  });

  it("resolves local parameter, requestBody, and response references", () => {
    const document = createDocument();
    const pathItem = (document.paths as Record<string, Record<string, unknown>>)[
      "/books/{bookId}"
    ]!;
    pathItem.parameters = [{ $ref: "#/components/parameters/SharedLimit" }];
    const operation = pathItem.get as Record<string, unknown>;
    operation.requestBody = { $ref: "#/components/requestBodies/NoteBody" };
    operation.responses = {
      "404": { $ref: "#/components/responses/NotFound" },
    };

    const artifact = normalizeContractArtifact(document, generatedModules);
    expect(artifact.operations[0]?.parameters).toContainEqual(
      expect.objectContaining({ name: "limit", location: "query" }),
    );
    expect(artifact.operations[0]?.requestBody?.required).toBe(true);
    expect(artifact.operations[0]?.responses[0]).toMatchObject({
      status: "404",
      description: "Missing",
    });
  });

  it("rejects external, circular, and missing local references", () => {
    const document = createDocument();
    const pathItem = (document.paths as Record<string, Record<string, unknown>>)[
      "/books/{bookId}"
    ]!;
    const operation = pathItem.get as Record<string, unknown>;

    operation.responses = {
      "200": { $ref: "https://example.com/schemas/Book" },
    };
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /unresolved external reference/,
    );

    operation.responses = {
      "200": { $ref: "#/components/responses/Missing" },
    };
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /references missing OpenAPI value/,
    );

    const components = document.components as {
      responses: Record<string, unknown>;
    };
    components.responses.LoopA = { $ref: "#/components/responses/LoopB" };
    components.responses.LoopB = { $ref: "#/components/responses/LoopA" };
    operation.responses = {
      "200": { $ref: "#/components/responses/LoopA" },
    };
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /circular reference/,
    );
  });

  it("rejects invalid contract type shapes", () => {
    expect(() => normalizeContractType({ type: "null" }, "t")).toThrow(
      "t cannot declare only the null type.",
    );
    expect(() => normalizeContractType({ type: "array" }, "t")).toThrow(
      "t.items is required for array types.",
    );
    expect(() => normalizeContractType({ type: "file" }, "t")).toThrow(
      't.type "file" is not supported.',
    );
    expect(() => normalizeContractType({ type: ["string", "integer"] }, "t")).toThrow(
      /exactly one non-null type/,
    );
    expect(() => normalizeContractType({ type: 1 }, "t")).toThrow(
      "t.type must be a string or a nullable two-item string array.",
    );
    expect(() => normalizeContractType({ type: "string", enum: [] }, "t")).toThrow(
      "t.enum must be a non-empty array.",
    );
    expect(() => normalizeContractType({ type: "string", enum: [{ nested: true }] }, "t")).toThrow(
      "t.enum[0] must be a scalar JSON value.",
    );
    expect(() => normalizeContractType({ $ref: "#/components/parameters/X" }, "t")).toThrow(
      /may only reference component schemas/,
    );
    expect(() =>
      normalizeContractType(
        { type: "object", required: "id", properties: { id: { type: "string" } } },
        "t",
      ),
    ).toThrow("t.required must be an array of property names.");
    expect(() =>
      normalizeContractType(
        { type: "object", required: ["missing"], properties: { id: { type: "string" } } },
        "t",
      ),
    ).toThrow('t.required references missing property "missing".');
    expect(
      normalizeContractType({ $ref: "#/components/schemas/Book", nullable: true }, "t"),
    ).toEqual({ kind: "reference", nullable: true, schema: "Book" });
  });

  it("rejects invalid parameters, responses, and component schemas", () => {
    const document = createDocument();
    const pathItem = (document.paths as Record<string, Record<string, unknown>>)[
      "/books/{bookId}"
    ]!;
    const operation = pathItem.get as Record<string, unknown>;

    operation.parameters = [{ name: "x", in: "matrix", schema: { type: "string" } }];
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /is not a supported parameter location/,
    );

    operation.parameters = [{ name: "x", in: "query" }];
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /schema is required/,
    );

    operation.parameters = { bad: true };
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /parameters must be an array/,
    );

    operation.parameters = [
      {
        name: "bookId",
        in: "path",
        required: true,
        schema: { type: "integer", format: "int32" },
      },
    ];
    delete operation.responses;
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /responses is required/,
    );

    operation.responses = {
      "200": { description: "ok" },
    };
    pathItem.summary = "ignored path summary";
    pathItem.post = {
      operationId: "createBook",
      responses: { "200": { description: "ok" } },
    };
    (document.components as { schemas: { Book: Record<string, unknown> } }).schemas.Book.type =
      "string";
    expect(() =>
      normalizeContractArtifact(document, {
        schemas: generatedModules.schemas,
        operations: new Map([
          ["getBook", "routes/getBook.ts"],
          ["createBook", "routes/createBook.ts"],
        ]),
      }),
    ).toThrow("OpenAPI components.schemas.Book must be an object schema.");
  });

  it("rejects unenforceable and unknown security schemes on operations", () => {
    const document: Record<string, unknown> = {
      openapi: "3.1.0",
      info: { title: "Sec", version: "1.0.0" },
      components: {
        schemas: {
          Book: {
            type: "object",
            required: ["id"],
            properties: { id: { type: "string" } },
          },
        },
        securitySchemes: {
          oauth: {
            type: "oauth2",
            flows: {
              implicit: {
                authorizationUrl: "https://example.com/oauth",
                scopes: { read: "read" },
              },
            },
          },
        },
      },
      paths: {
        "/books": {
          get: {
            operationId: "getBook",
            security: [{ oauth: ["read"] }],
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };

    expect(() =>
      normalizeContractArtifact(document, {
        schemas: new Map([["Book", "schemas/Book.ts"]]),
        operations: new Map([["getBook", "routes/getBook.ts"]]),
      }),
    ).toThrow(/cannot enforce at runtime: oauth \(oauth2\)/);

    (
      (document.paths as Record<string, Record<string, Record<string, unknown>>>)["/books"]!
        .get as Record<string, unknown>
    ).security = [{ missing: [] }];
    expect(() =>
      normalizeContractArtifact(document, {
        schemas: new Map([["Book", "schemas/Book.ts"]]),
        operations: new Map([["getBook", "routes/getBook.ts"]]),
      }),
    ).toThrow(/missing \(unknown\)/);
  });

  it("validates artifact schema and operation references", () => {
    const document = createDocument();
    const book = (document.components as { schemas: { Book: Record<string, unknown> } }).schemas
      .Book;
    (book["x-hexkit"] as { persistence: { identity: string } }).persistence.identity = "missing";
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /persistence identity "missing" is not a property/,
    );

    (book["x-hexkit"] as { persistence: { identity: string } }).persistence.identity = "id";
    (book.properties as Record<string, unknown>).authorId = {
      type: "string",
      "x-hexkit": { reference: { schema: "Author", property: "id" } },
    };
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /references unknown schema "Author"/,
    );

    (book.properties as Record<string, unknown>).authorId = {
      type: "string",
      "x-hexkit": { reference: { schema: "Book", property: "missing" } },
    };
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /references unknown property "Book.missing"/,
    );

    (book.properties as Record<string, unknown>).authorId = {
      $ref: "#/components/schemas/Missing",
    };
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /references unknown schema "Missing"/,
    );

    (book.properties as Record<string, unknown>).authorId = { type: "string" };
    const operation = (document.paths as Record<string, Record<string, unknown>>)[
      "/books/{bookId}"
    ]!.get as Record<string, unknown>;
    operation["x-hexkit"] = { operation: { aggregate: "Missing", action: "read" } };
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      /names unknown aggregate "Missing"/,
    );
  });

  it("skips non-HTTP path item members and allows documents without components", () => {
    const document: Record<string, unknown> = {
      openapi: "3.1.0",
      info: { title: "Bare", version: "1.0.0" },
      paths: {
        "/health": {
          summary: "Health",
          parameters: [],
          get: {
            operationId: "getBook",
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };

    const artifact = normalizeContractArtifact(document, {
      schemas: new Map(),
      operations: new Map([["getBook", "routes/getBook.ts"]]),
    });
    expect(artifact.schemas).toEqual([]);
    expect(artifact.operations).toHaveLength(1);
  });
});

describe("inspectGeneratedIndexes", () => {
  it("uses the TypeScript AST to map exported schemas and route registry entries", () => {
    const modules = inspectGeneratedIndexes(
      `
        import { Book } from "./Book.ts";
        export { Book };
      `,
      `
        import { serverRoute as getBookRoute } from "./getBook.ts";
        export const routes = { getBook: getBookRoute } as const;
      `,
    );

    expect([...modules.schemas]).toEqual([["Book", "schemas/Book.ts"]]);
    expect([...modules.operations]).toEqual([["getBook", "routes/getBook.ts"]]);
  });

  it("supports re-export sources, string export names, and string route keys", () => {
    expect([
      ...inspectSchemaIndex(`
        export { Book as "BookModel" } from "./Book.ts";
        export { Tag } from "./Tag";
      `),
    ]).toEqual([
      ["BookModel", "schemas/Book.ts"],
      ["Tag", "schemas/Tag.ts"],
    ]);

    expect([
      ...inspectRoutesIndex(`
        import { serverRoute as getBookRoute } from "./getBook.ts";
        export const routes = { "getBook": getBookRoute } satisfies Record<string, unknown>;
      `),
    ]).toEqual([["getBook", "routes/getBook.ts"]]);
  });

  it("rejects unsupported generated index shapes", () => {
    expect(() => inspectSchemaIndex("export const x = (")).toThrow(/Unable to parse Apical index/);

    expect(() =>
      inspectSchemaIndex(`
        import { Book } from "book-pkg";
        export { Book };
      `),
    ).toThrow(/external module "book-pkg"/);

    expect(() =>
      inspectRoutesIndex(`
        import { serverRoute as getBookRoute } from "./getBook.ts";
        export const routes = getBookRoute;
      `),
    ).toThrow('Apical export "routes" must be an object literal.');

    expect(() =>
      inspectRoutesIndex(`
        import { serverRoute as getBookRoute } from "./getBook.ts";
        export const routes = { ...getBookRoute };
      `),
    ).toThrow(/unsupported entry/);

    expect(() =>
      inspectRoutesIndex(`
        import { serverRoute as getBookRoute } from "./getBook.ts";
        export const routes = { [Symbol.iterator]: getBookRoute };
      `),
    ).toThrow(/unsupported entry|computed route key/);

    expect(() =>
      inspectRoutesIndex(`
        import { helper as getBookRoute } from "./getBook.ts";
        export const routes = { getBook: getBookRoute };
      `),
    ).toThrow(/not backed by an imported serverRoute module/);

    expect(() =>
      inspectRoutesIndex(`
        export const routes = { getBook: missing };
      `),
    ).toThrow(/not backed by an imported serverRoute module/);
  });
});
