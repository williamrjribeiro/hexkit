import { randomInt } from "node:crypto";

export const INT32_MAX = 2_147_483_647;

export type AcceptanceIds = {
  petId: number;
  orderId: number;
  invalidOrderId: number;
  missingPetId: number;
};

export type AcceptanceIdDraw = () => number;

function drawRandomInt32(): number {
  return randomInt(1, INT32_MAX + 1);
}

export function createAcceptanceIds(draw: AcceptanceIdDraw = drawRandomInt32): AcceptanceIds {
  const values: number[] = [];

  while (values.length < 4) {
    const value = draw();
    if (!Number.isSafeInteger(value) || value < 1 || value > INT32_MAX) {
      throw new Error(`Acceptance ID must be a positive int32: ${String(value)}`);
    }
    if (!values.includes(value)) values.push(value);
  }

  const [petId, orderId, invalidOrderId, missingPetId] = values;
  if (
    petId === undefined ||
    orderId === undefined ||
    invalidOrderId === undefined ||
    missingPetId === undefined
  ) {
    throw new Error("Failed to create four acceptance IDs");
  }

  return { petId, orderId, invalidOrderId, missingPetId };
}
