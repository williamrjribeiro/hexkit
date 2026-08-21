export function asRecord(value: unknown, location: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${location} must be an object.`);
  }

  return value as Record<string, unknown>;
}

export function optionalRecord(
  value: unknown,
  location: string,
): Record<string, unknown> | undefined {
  return value === undefined ? undefined : asRecord(value, location);
}

export function requiredString(value: unknown, location: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${location} must be a non-empty string.`);
  }

  return value;
}

export function optionalString(value: unknown, location: string): string | undefined {
  return value === undefined ? undefined : requiredString(value, location);
}

export function optionalBoolean(value: unknown, location: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`${location} must be a boolean.`);
  }

  return value;
}

export function optionalDescription(
  owner: Record<string, unknown>,
  location: string,
): { description?: string } {
  const description = optionalString(owner.description, `${location}.description`);
  return description === undefined ? {} : { description };
}

export function assertOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  location: string,
): void {
  const unexpectedKey = Object.keys(value).find((key) => !allowedKeys.includes(key));
  if (unexpectedKey !== undefined) {
    throw new Error(`${location} contains unsupported key "${unexpectedKey}".`);
  }
}
