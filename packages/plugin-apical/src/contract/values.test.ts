import { describe, expect, it } from "vite-plus/test";

import {
  asRecord,
  assertOnlyKeys,
  optionalBoolean,
  optionalDescription,
  optionalRecord,
  optionalString,
  requiredString,
} from "./values.ts";

describe("values helpers", () => {
  it("rejects non-object values for asRecord", () => {
    expect(() => asRecord(null, "doc")).toThrow("doc must be an object.");
    expect(() => asRecord([], "doc")).toThrow("doc must be an object.");
    expect(() => asRecord("x", "doc")).toThrow("doc must be an object.");
  });

  it("returns undefined for missing optionalRecord and rejects bad shapes", () => {
    expect(optionalRecord(undefined, "doc")).toBeUndefined();
    expect(optionalRecord({ a: 1 }, "doc")).toEqual({ a: 1 });
    expect(() => optionalRecord(1, "doc")).toThrow("doc must be an object.");
  });

  it("validates required and optional strings", () => {
    expect(requiredString("ok", "name")).toBe("ok");
    expect(() => requiredString("  ", "name")).toThrow("name must be a non-empty string.");
    expect(optionalString(undefined, "name")).toBeUndefined();
    expect(optionalString("ok", "name")).toBe("ok");
  });

  it("validates optionalBoolean and rejects non-booleans", () => {
    expect(optionalBoolean(undefined, "flag")).toBeUndefined();
    expect(optionalBoolean(true, "flag")).toBe(true);
    expect(optionalBoolean(false, "flag")).toBe(false);
    expect(() => optionalBoolean("yes", "flag")).toThrow("flag must be a boolean.");
  });

  it("rejects unexpected keys via assertOnlyKeys", () => {
    expect(() => assertOnlyKeys({ a: 1, b: 2 }, ["a"], "ext")).toThrow(
      'ext contains unsupported key "b".',
    );
    expect(() => assertOnlyKeys({ a: 1 }, ["a"], "ext")).not.toThrow();
  });

  it("spreads optionalDescription only when present", () => {
    expect(optionalDescription({}, "doc")).toEqual({});
    expect(optionalDescription({ description: "A book" }, "doc")).toEqual({
      description: "A book",
    });
  });
});
