import { asRecord } from "./values.ts";

export type RefResolver = {
  resolve: (value: unknown, location: string) => Record<string, unknown>;
};

export function decodeJsonPointerSegment(segment: string): string {
  return decodeURIComponent(segment).replaceAll("~1", "/").replaceAll("~0", "~");
}

export function createRefResolver(document: Record<string, unknown>): RefResolver {
  return {
    resolve: (value, location) => {
      let current = asRecord(value, location);
      const visited = new Set<string>();

      while (typeof current.$ref === "string") {
        const reference = current.$ref;
        if (!reference.startsWith("#/")) {
          throw new Error(`${location} contains unresolved external reference "${reference}".`);
        }
        if (visited.has(reference)) {
          throw new Error(`${location} contains a circular reference "${reference}".`);
        }
        visited.add(reference);

        let target: unknown = document;
        for (const encodedSegment of reference.slice(2).split("/")) {
          const segment = decodeJsonPointerSegment(encodedSegment);
          const targetRecord = asRecord(target, `reference "${reference}"`);
          if (!(segment in targetRecord)) {
            throw new Error(`${location} references missing OpenAPI value "${reference}".`);
          }
          target = targetRecord[segment];
        }

        current = asRecord(target, `reference "${reference}"`);
      }

      return current;
    },
  };
}
