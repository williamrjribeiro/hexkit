import { describe, expect, it } from "vite-plus/test";

import { createAcceptanceIds, INT32_MAX } from "./api-fixtures.ts";

describe("Given deterministic acceptance ID draws", () => {
  it("when a collision occurs, then four distinct safe int32 IDs are produced", () => {
    const draws = [17, 17, 23, 29, 31];
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
        "invalidOrderId": 29,
        "missingPetId": 31,
        "orderId": 23,
        "petId": 17,
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
