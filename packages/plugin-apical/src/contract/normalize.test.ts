import { describe, expect, it } from "vite-plus/test";

import { normalizeContractArtifact } from "./normalize.ts";

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

  it("rejects OpenAPI versions outside 3.1.x", () => {
    const document = createDocument();
    document.openapi = "3.0.3";
    expect(() => normalizeContractArtifact(document, generatedModules)).toThrow(
      'Hexkit requires OpenAPI 3.1.x; received "3.0.3".',
    );
  });

  it("resolves local parameter, requestBody, and response references through the orchestrator", () => {
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

  it("allows documents without components", () => {
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
