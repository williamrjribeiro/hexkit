import { describe, expect, it } from "vite-plus/test";

import { createRefResolver } from "./json-pointer.ts";
import {
  normalizeMedia,
  normalizeOperations,
  normalizeParameter,
  normalizeParameters,
  normalizeRequestBody,
  normalizeResponses,
} from "./operation-normalize.ts";

const resolve = createRefResolver({
  components: {
    parameters: {
      SharedLimit: { name: "limit", in: "query", schema: { type: "integer" } },
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
      NotFound: { description: "Missing" },
    },
  },
}).resolve;

describe("Given operation parameters", () => {
  it("when in is unsupported, then normalization fails", () => {
    expect(() =>
      normalizeParameter(resolve, { name: "x", in: "matrix", schema: { type: "string" } }, "p"),
    ).toThrow('p.in "matrix" is not a supported parameter location.');
  });

  it("when schema is missing, then normalization fails", () => {
    expect(() => normalizeParameter(resolve, { name: "x", in: "query" }, "p")).toThrow(
      "p.schema is required.",
    );
  });

  it("when parameters is not an array, then normalization fails", () => {
    expect(() => normalizeParameters(resolve, {}, { parameters: { bad: true } }, "op")).toThrow(
      "op.parameters must be an array.",
    );
  });

  it("when in is path, then the parameter is required even if required is false", () => {
    expect(
      normalizeParameter(
        resolve,
        { name: "id", in: "path", required: false, schema: { type: "string" } },
        "p",
      ).required,
    ).toBe(true);
  });

  it("when in is header or cookie, then those locations are accepted", () => {
    expect(
      normalizeParameter(resolve, { name: "x", in: "header", schema: { type: "string" } }, "p")
        .location,
    ).toBe("header");
    expect(
      normalizeParameter(resolve, { name: "sid", in: "cookie", schema: { type: "string" } }, "p")
        .location,
    ).toBe("cookie");
  });

  it("when operation and path parameters share a name, then the operation parameter wins", () => {
    const parameters = normalizeParameters(
      resolve,
      { parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }] },
      { parameters: [{ name: "limit", in: "query", schema: { type: "string" } }] },
      "op",
    );
    expect(parameters).toEqual([
      expect.objectContaining({ name: "limit", type: { kind: "string", nullable: false } }),
    ]);
  });

  it("when a local parameter $ref is present, then the shared parameter is used", () => {
    const parameters = normalizeParameters(
      resolve,
      { parameters: [{ $ref: "#/components/parameters/SharedLimit" }] },
      {},
      "op",
    );
    expect(parameters).toContainEqual(
      expect.objectContaining({ name: "limit", location: "query" }),
    );
  });
});

describe("Given request bodies, media, and responses", () => {
  it("when media has no schema, then only the mediaType is kept", () => {
    expect(normalizeMedia({ "text/plain": {} }, "content")).toEqual([{ mediaType: "text/plain" }]);
  });

  it("when requestBody is a local $ref, then required is taken from the target", () => {
    expect(
      normalizeRequestBody(resolve, { $ref: "#/components/requestBodies/NoteBody" }, "body"),
    ).toEqual(expect.objectContaining({ required: true }));
  });

  it("when responses is a local $ref, then description is taken from the target", () => {
    expect(
      normalizeResponses(
        resolve,
        { "404": { $ref: "#/components/responses/NotFound" } },
        "responses",
      ),
    ).toEqual([{ status: "404", description: "Missing", media: [] }]);
  });

  it("when a success response declares headers, then those headers are kept with their schemas", () => {
    expect(
      normalizeResponses(
        resolve,
        {
          "200": {
            description: "ok",
            headers: {
              "X-Rate-Limit": { schema: { type: "integer", format: "int32" } },
              "X-Expires-After": { required: true, schema: { type: "string" } },
            },
          },
        },
        "responses",
      ),
    ).toEqual([
      {
        status: "200",
        description: "ok",
        media: [],
        headers: [
          {
            name: "X-Rate-Limit",
            required: false,
            type: { kind: "integer", nullable: false, format: "int32" },
          },
          {
            name: "X-Expires-After",
            required: true,
            type: { kind: "string", nullable: false },
          },
        ],
      },
    ]);
  });
});

describe("Given OpenAPI operations", () => {
  it("when responses is missing, then normalization fails", () => {
    expect(() =>
      normalizeOperations(
        {
          paths: {
            "/books": {
              get: { operationId: "getBook" },
            },
          },
        },
        { schemas: new Map(), operations: new Map([["getBook", "routes/getBook.ts"]]) },
        [],
        [],
        resolve,
      ),
    ).toThrow("OpenAPI paths./books.get.responses is required.");
  });

  it("when an operation has no Apical route, then normalization fails", () => {
    expect(() =>
      normalizeOperations(
        {
          paths: {
            "/books": {
              get: {
                operationId: "getBook",
                responses: { "200": { description: "ok" } },
              },
            },
          },
        },
        { schemas: new Map(), operations: new Map() },
        [],
        [],
        resolve,
      ),
    ).toThrow('OpenAPI operation "getBook" has no matching entry in Apical routes/index.ts.');
  });

  it("when a path item has non-HTTP members, then they are skipped", () => {
    const operations = normalizeOperations(
      {
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
      },
      { schemas: new Map(), operations: new Map([["getBook", "routes/getBook.ts"]]) },
      [],
      [],
      resolve,
    );
    expect(operations).toHaveLength(1);
    expect(operations[0]?.operationId).toBe("getBook");
  });
});
