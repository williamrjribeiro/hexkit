import { describe, expect, it } from "vite-plus/test";

import type { ContractHttpMethod } from "@hexkit/plugin-apical";

import { persistenceKindFromAction } from "./repository.ts";

type Case = {
  action: string;
  httpMethod: ContractHttpMethod;
  resultCardinality: "one" | "many" | "void";
  parameterCount: number;
  expected: "insert" | "update" | "delete" | "select" | "list" | "stub";
};

describe("Given a repository action", () => {
  it.each([
    {
      action: "create",
      httpMethod: "get",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "insert",
    },
    {
      action: "Add",
      httpMethod: "get",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "insert",
    },
    {
      action: "place",
      httpMethod: "post",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "insert",
    },
    {
      action: "insert",
      httpMethod: "post",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "insert",
    },
    {
      action: "update",
      httpMethod: "get",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "update",
    },
    {
      action: "update",
      httpMethod: "post",
      resultCardinality: "one",
      parameterCount: 3,
      expected: "update",
    },
    {
      action: "patch",
      httpMethod: "get",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "update",
    },
    {
      action: "delete",
      httpMethod: "get",
      resultCardinality: "void",
      parameterCount: 1,
      expected: "delete",
    },
    {
      action: "remove",
      httpMethod: "get",
      resultCardinality: "void",
      parameterCount: 1,
      expected: "delete",
    },
    {
      action: "list",
      httpMethod: "post",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "list",
    },
    {
      action: "findAll",
      httpMethod: "get",
      resultCardinality: "many",
      parameterCount: 0,
      expected: "list",
    },
    {
      action: "index",
      httpMethod: "get",
      resultCardinality: "many",
      parameterCount: 0,
      expected: "list",
    },
    {
      action: "getHealth",
      httpMethod: "get",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "stub",
    },
    {
      action: "health",
      httpMethod: "get",
      resultCardinality: "one",
      parameterCount: 0,
      expected: "stub",
    },
    {
      action: "readiness",
      httpMethod: "get",
      resultCardinality: "one",
      parameterCount: 0,
      expected: "stub",
    },
    {
      action: "healthcheck",
      httpMethod: "get",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "stub",
    },
    {
      action: "get",
      httpMethod: "post",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "select",
    },
    {
      action: "read",
      httpMethod: "post",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "select",
    },
    {
      action: "find",
      httpMethod: "post",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "select",
    },
    {
      action: "getById",
      httpMethod: "post",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "select",
    },
    {
      action: "search",
      httpMethod: "post",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "insert",
    },
    {
      action: "search",
      httpMethod: "put",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "update",
    },
    {
      action: "search",
      httpMethod: "patch",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "update",
    },
    {
      action: "search",
      httpMethod: "delete",
      resultCardinality: "void",
      parameterCount: 1,
      expected: "delete",
    },
    {
      action: "search",
      httpMethod: "get",
      resultCardinality: "one",
      parameterCount: 1,
      expected: "select",
    },
    {
      action: "get",
      httpMethod: "get",
      resultCardinality: "many",
      parameterCount: 1,
      expected: "list",
    },
    {
      action: "get",
      httpMethod: "get",
      resultCardinality: "one",
      parameterCount: 0,
      expected: "stub",
    },
    {
      action: "get",
      httpMethod: "get",
      resultCardinality: "void",
      parameterCount: 0,
      expected: "stub",
    },
  ] satisfies Case[])(
    "when action=$action method=$httpMethod cardinality=$resultCardinality params=$parameterCount, then $expected",
    ({ action, httpMethod, resultCardinality, parameterCount, expected }) => {
      expect(persistenceKindFromAction(action, httpMethod, resultCardinality, parameterCount)).toBe(
        expected,
      );
    },
  );

  it("when a parameterized GET returns a scalar instead of the aggregate, then persistence is stub", () => {
    expect(
      persistenceKindFromAction("get", "get", "one", 2, {
        returnTypeExpression: "string",
        aggregate: "Widget",
      }),
    ).toBe("stub");
  });

  it("when a parameterized GET returns the aggregate, then persistence stays select", () => {
    expect(
      persistenceKindFromAction("get", "get", "one", 1, {
        returnTypeExpression: "Widget | undefined",
        aggregate: "Widget",
      }),
    ).toBe("select");
  });

  it("when the HTTP method cannot be classified, then the calculation throws", () => {
    expect(() => persistenceKindFromAction("search", "head", "one", 0)).toThrow(
      /Cannot infer persistence action/,
    );
    expect(() => persistenceKindFromAction("search", "options", "one", 0)).toThrow(
      /Cannot infer persistence action/,
    );
    expect(() => persistenceKindFromAction("search", "trace", "one", 0)).toThrow(
      /Cannot infer persistence action/,
    );
  });

  it("when a parameterless read groups by a column, then persistence is group-count over stub", () => {
    expect(
      persistenceKindFromAction("get", "get", "one", 0, {
        aggregate: "Widget",
        groupBy: "status",
      }),
    ).toBe("group-count");
  });

  it("when a listed read groups by a column, then persistence is group-count over list", () => {
    expect(
      persistenceKindFromAction("get", "get", "many", 1, {
        aggregate: "Widget",
        groupBy: "status",
      }),
    ).toBe("group-count");
  });

  it("when a write action groups by a column, then the calculation throws", () => {
    expect(() =>
      persistenceKindFromAction("create", "post", "one", 1, {
        aggregate: "Widget",
        groupBy: "status",
      }),
    ).toThrow(
      'group-by persistence requires a read action, but action "create" resolves to "insert".',
    );
  });
});
