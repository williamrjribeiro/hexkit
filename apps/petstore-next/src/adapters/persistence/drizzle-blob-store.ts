import type { BlobStore } from "../../core/ports/blob-store.ts";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { customType, pgTable, text } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";

const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

export const hexkitBlobs = pgTable("hexkit_blobs", {
  key: text("key").primaryKey(),
  content: bytea("content").notNull(),
});

export function createDrizzleBlobStore(
  db: NodePgDatabase<Record<string, unknown>>,
): BlobStore {
  return {
    async put(bytes) {
      const key = randomUUID();
      await db.insert(hexkitBlobs).values({ key, content: Buffer.from(bytes) });
      return { key };
    },
    async get(key) {
      const [row] = await db
        .select()
        .from(hexkitBlobs)
        .where(eq(hexkitBlobs.key, key))
        .limit(1);
      return row ? new Uint8Array(row.content) : undefined;
    },
    async delete(key) {
      const deleted = await db
        .delete(hexkitBlobs)
        .where(eq(hexkitBlobs.key, key))
        .returning();
      return deleted.length > 0;
    },
  };
}
