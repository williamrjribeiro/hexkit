export function renderNextStartupScript(migrationPath: string): string {
  return `#!/bin/sh
set -eu

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ${migrationPath}
exec ./node_modules/.bin/next start --hostname 0.0.0.0 --port "\${PORT:-3000}"
`;
}

export function renderNextDatabaseSource(): string {
  return `import { drizzle } from "drizzle-orm/node-postgres";
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
`;
}
