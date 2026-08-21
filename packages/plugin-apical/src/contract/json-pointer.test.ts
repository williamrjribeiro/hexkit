import { describe, expect, it } from "vite-plus/test";

import { createRefResolver } from "./json-pointer.ts";

describe("Given a tiny OpenAPI document", () => {
  it("when the value has no $ref, then the object is returned unchanged", () => {
    const { resolve } = createRefResolver({});
    expect(resolve({ name: "limit", in: "query" }, "param")).toEqual({
      name: "limit",
      in: "query",
    });
  });

  it("when resolve follows a local $ref, then the target object is returned", () => {
    const { resolve } = createRefResolver({
      components: {
        parameters: {
          Limit: { name: "limit", in: "query" },
        },
      },
    });

    expect(resolve({ $ref: "#/components/parameters/Limit" }, "param")).toEqual({
      name: "limit",
      in: "query",
    });
  });

  it("when the pointer uses escaped segments, then ~1 and ~0 decode to / and ~", () => {
    const { resolve } = createRefResolver({
      components: {
        schemas: {
          "a/b~c": { type: "object" },
        },
      },
    });

    expect(resolve({ $ref: "#/components/schemas/a~1b~0c" }, "schema")).toEqual({ type: "object" });
  });

  it("when the reference is external, then it reports an unresolved external reference", () => {
    const { resolve } = createRefResolver({});

    expect(() => resolve({ $ref: "https://example.com/schemas/Book" }, "response")).toThrow(
      'response contains unresolved external reference "https://example.com/schemas/Book".',
    );
  });

  it("when the pointer is missing, then it reports a missing OpenAPI value", () => {
    const { resolve } = createRefResolver({ components: { responses: {} } });

    expect(() => resolve({ $ref: "#/components/responses/Missing" }, "response")).toThrow(
      'response references missing OpenAPI value "#/components/responses/Missing".',
    );
  });

  it("when refs form a cycle, then it reports a circular reference", () => {
    const { resolve } = createRefResolver({
      components: {
        responses: {
          LoopA: { $ref: "#/components/responses/LoopB" },
          LoopB: { $ref: "#/components/responses/LoopA" },
        },
      },
    });

    expect(() => resolve({ $ref: "#/components/responses/LoopA" }, "response")).toThrow(
      'response contains a circular reference "#/components/responses/LoopA".',
    );
  });
});
