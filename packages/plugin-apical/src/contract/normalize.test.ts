import { describe, expect, it } from "vite-plus/test";

import { inspectGeneratedIndexes } from "./generated-index.ts";
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
    },
    paths: {
      "/books/{bookId}": {
        get: {
          operationId: "getBook",
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
          ],
          responses: {
            "200": {
              description: "Book found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Book" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Book: {
          type: "object",
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
      },
      schemas: [
        {
          name: "Book",
          modulePath: "schemas/Book.ts",
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
          ],
        },
      ],
      operations: [
        {
          operationId: "getBook",
          method: "get",
          path: "/books/{bookId}",
          modulePath: "routes/getBook.ts",
          extension: {
            aggregate: "Book",
            action: "read",
          },
          responses: [
            {
              status: "200",
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "reference", nullable: false, schema: "Book" },
                },
              ],
            },
          ],
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
});
