import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

export function renderDrizzleBlobStoreFile(): GeneratedFile {
  const imports: ImportDeclaration[] = [
    { from: "node:crypto", names: ["randomUUID"] },
    { from: "drizzle-orm", names: ["eq"] },
    {
      from: "drizzle-orm/node-postgres",
      names: ["NodePgDatabase"],
      typeOnly: true,
    },
    { from: "drizzle-orm/pg-core", names: ["customType", "pgTable", "text"] },
    {
      from: "../../core/ports/blob-store.ts",
      names: ["BlobStore"],
      typeOnly: true,
    },
  ];

  const statements = [
    ["const bytea = customType<{ data: Buffer }>({", '  dataType: () => "bytea",', "});"].join(
      "\n",
    ),
    [
      'export const hexkitBlobs = pgTable("hexkit_blobs", {',
      '  key: text("key").primaryKey(),',
      '  content: bytea("content").notNull(),',
      "});",
    ].join("\n"),
    [
      "export function createDrizzleBlobStore(",
      "  db: NodePgDatabase<Record<string, unknown>>,",
      "): BlobStore {",
      "  return {",
      "    async put(bytes) {",
      "      const key = randomUUID();",
      "      await db.insert(hexkitBlobs).values({ key, content: Buffer.from(bytes) });",
      "      return { key };",
      "    },",
      "    async get(key) {",
      "      const [row] = await db",
      "        .select()",
      "        .from(hexkitBlobs)",
      "        .where(eq(hexkitBlobs.key, key))",
      "        .limit(1);",
      "      return row ? new Uint8Array(row.content) : undefined;",
      "    },",
      "    async delete(key) {",
      "      const deleted = await db",
      "        .delete(hexkitBlobs)",
      "        .where(eq(hexkitBlobs.key, key))",
      "        .returning();",
      "      return deleted.length > 0;",
      "    },",
      "  };",
      "}",
    ].join("\n"),
  ];

  return {
    path: "src/adapters/persistence/drizzle-blob-store.ts",
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}
