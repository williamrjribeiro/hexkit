import { describe, expect, it } from "vite-plus/test";

import type { ContractHttpMethod, ContractOperation } from "@hexkit/plugin-apical";

import { refineMethodKind, resolveMethodKind } from "./method-kind.ts";
import type { PersistenceMethodKind } from "./method-kind.ts";

function operation(method: ContractHttpMethod, operationId = "doThing"): ContractOperation {
  return {
    operationId,
    method,
    path: "/",
    modulePath: "routes/doThing.ts",
    parameters: [],
    responses: [],
    security: { overridesGlobal: false, requirements: [], apicalServerHeaderNames: [] },
  };
}

describe("resolveMethodKind", () => {
  it.each([
    ["create", "insert"],
    ["add", "insert"],
    ["place", "insert"],
    ["insert", "insert"],
    ["update", "update"],
    ["patch", "update"],
    ["delete", "delete"],
    ["remove", "delete"],
    ["list", "list"],
    ["findall", "list"],
    ["index", "list"],
    ["gethealth", "stub"],
    ["health", "stub"],
    ["healthcheck", "stub"],
    ["readiness", "stub"],
    ["get", "select"],
    ["read", "select"],
    ["find", "select"],
    ["getById", "select"],
  ] as const)("when action is %s, then kind is %s", (action, kind) => {
    expect(resolveMethodKind(operation("options"), action)).toBe(kind);
  });

  it("when action is unmatched, then HTTP method supplies insert/update/delete/select", () => {
    expect(resolveMethodKind(operation("post"), "fetch")).toBe("insert");
    expect(resolveMethodKind(operation("put"), "fetch")).toBe("update");
    expect(resolveMethodKind(operation("patch"), "fetch")).toBe("update");
    expect(resolveMethodKind(operation("delete"), "fetch")).toBe("delete");
    expect(resolveMethodKind(operation("get"), "fetch")).toBe("select");
  });

  it("when action and HTTP method cannot be inferred, then it throws", () => {
    expect(() => resolveMethodKind(operation("options", "probeWidget"), "probe")).toThrow(
      'Cannot infer persistence action for operation "probeWidget" (options). Add x-hexkit.operation.action.',
    );
  });
});

describe("refineMethodKind", () => {
  it.each([
    {
      kind: "select" as const,
      parameterCount: 0,
      returnsArray: true,
      expected: "list",
    },
    {
      kind: "select" as const,
      parameterCount: 0,
      returnsArray: false,
      expected: "stub",
    },
    {
      kind: "select" as const,
      parameterCount: 1,
      returnsArray: true,
      expected: "select",
    },
    {
      kind: "insert" as const,
      parameterCount: 0,
      returnsArray: true,
      expected: "insert",
    },
  ] satisfies ReadonlyArray<{
    kind: PersistenceMethodKind;
    parameterCount: number;
    returnsArray: boolean;
    expected: PersistenceMethodKind;
  }>)(
    "when kind is $kind with parameterCount $parameterCount and returnsArray $returnsArray, then result is $expected",
    ({ kind, parameterCount, returnsArray, expected }) => {
      expect(refineMethodKind(kind, { parameterCount, returnsArray })).toBe(expected);
    },
  );
});
