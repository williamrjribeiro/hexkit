import { describe, expect, it } from "vite-plus/test";

import { createAcceptanceIds, INT32_MAX } from "./api-fixtures.ts";

describe("Given deterministic acceptance ID draws", () => {
  it("when a collision occurs, then four distinct safe int32 IDs are produced", () => {
    const draws = [17, 17, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67];
    let index = 0;

    const ids = createAcceptanceIds(() => {
      const value = draws[index];
      index += 1;
      if (value === undefined) throw new Error("test draw sequence exhausted");
      return value;
    });
    const values = Object.values(ids);

    expect(ids).toMatchInlineSnapshot(`
      {
        "categoryOnlyPetId": 41,
        "emptyCategoryPetId": 53,
        "emptyTagsPetId": 47,
        "invalidOrderId": 29,
        "minimalPetId": 37,
        "missingPetId": 31,
        "orderId": 23,
        "partialCategoryPetId": 59,
        "petId": 17,
        "putOmitPetId": 61,
        "replaceUrlsPetId": 67,
        "tagsOnlyPetId": 43,
      }
    `);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(Number.isSafeInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(INT32_MAX);
    }
  });
});
