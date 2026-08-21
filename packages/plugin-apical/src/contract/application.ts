import type { ContractApplication } from "./types.ts";
import { optionalString, requiredString } from "./values.ts";

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-zA-Z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .toLowerCase();

  if (slug.length === 0) {
    throw new Error("OpenAPI info.title must contain at least one letter or number.");
  }

  return slug;
}

export function normalizeApplication(info: Record<string, unknown>): ContractApplication {
  const title = requiredString(info.title, "OpenAPI info.title");
  const version = requiredString(info.version, "OpenAPI info.version");
  const description = optionalString(info.description, "OpenAPI info.description");
  return {
    title,
    version,
    slug: slugify(title),
    ...(description === undefined ? {} : { description }),
  };
}
