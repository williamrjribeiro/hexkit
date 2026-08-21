import { describe, expect, it } from "vite-plus/test";

import { compareText, unique } from "./text.ts";

describe("Given unordered strings", () => {
  it("when compared, then lexicographic order is stable including equality", () => {
    expect(compareText("a", "b")).toBe(-1);
    expect(compareText("b", "a")).toBe(1);
    expect(compareText("same", "same")).toBe(0);
  });
});

describe("Given duplicate values", () => {
  it("when uniqued, then first occurrences are kept", () => {
    expect(unique(["Pet", "Order", "Pet"])).toEqual(["Pet", "Order"]);
    expect(unique([])).toEqual([]);
  });
});
