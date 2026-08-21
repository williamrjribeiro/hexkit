import { compareText, relativeImportPath } from "@hexkit/codegen";

import { SERVER_FILE_PATH } from "../data/hono-static.ts";
import type { RuntimeRepositoryBinding } from "../model/resolve-repositories.ts";

export function renderStartupScript(migrationPath: string): string {
  return `#!/bin/sh
set -eu

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ${migrationPath}
exec node src/runtime/server.ts
`;
}

export function renderServerSource(options: {
  applicationTitle: string;
  createAppFactoryName: string;
  runtimeFilePath: string;
  repositories: readonly RuntimeRepositoryBinding[];
}): string {
  const localImports = [
    ...options.repositories.map((repository) => ({
      from: relativeImportPath(SERVER_FILE_PATH, repository.filePath),
      name: repository.factoryName,
    })),
    {
      from: relativeImportPath(SERVER_FILE_PATH, options.runtimeFilePath),
      name: options.createAppFactoryName,
    },
  ].toSorted((left, right) => compareText(left.from, right.from));

  const importBlock = localImports
    .map((declaration) => `import { ${declaration.name} } from "${declaration.from}";`)
    .join("\n");

  const appBindings = options.repositories
    .map((repository) => `  ${repository.runtimeKey}: ${repository.factoryName}(db),`)
    .join("\n");

  const listeningPrefix = escapeTemplateLiteral(
    `${options.applicationTitle} listening on http://0.0.0.0:`,
  );

  return `import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

${importBlock}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const port = Number(process.env.PORT ?? "3000");
if (!Number.isInteger(port) || port < 1) throw new Error("PORT must be a positive integer");

const pool = new Pool({ connectionString });
const db = drizzle(pool);
const app = ${options.createAppFactoryName}({
${appBindings}
});

serve({ fetch: app.fetch, port }, ({ port: listeningPort }) => {
  console.log(\`${listeningPrefix}\${listeningPort}\`);
});
`;
}

export function escapeTemplateLiteral(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
}
