import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Database = ReturnType<typeof drizzle>;

let pool: Pool | undefined;
let database: Database | undefined;

export function getDatabase(): Database {
  if (database === undefined) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");

    pool = new Pool({ connectionString });
    database = drizzle(pool);
  }

  return database;
}
