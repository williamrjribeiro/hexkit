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
});
