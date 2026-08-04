import type { GeneratedFile, HexkitPlugin } from "@hexkit/plugin-api";

const packageManifest = {
  name: "generated-petstore",
  version: "0.0.0",
  private: true,
  type: "module",
  scripts: {
    check: "tsc --noEmit",
    migrate: 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/0000_petstore.sql',
    start: "node src/runtime/server.ts",
  },
  dependencies: {
    "@hono/node-server": "2.0.12",
    "@standard-schema/spec": "1.1.0",
    "drizzle-orm": "0.45.2",
    hono: "4.13.0",
    pg: "8.22.0",
    zod: "4.4.3",
  },
  devDependencies: {
    "@types/node": "26.1.2",
    "@types/pg": "8.20.3",
    typescript: "7.0.2",
  },
  engines: {
    node: ">=24.18.1",
  },
  packageManager: "pnpm@11.18.0",
};

const tsconfig = {
  compilerOptions: {
    target: "esnext",
    lib: ["es2023"],
    moduleDetection: "force",
    module: "nodenext",
    moduleResolution: "nodenext",
    types: ["node"],
    strict: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    isolatedModules: true,
    verbatimModuleSyntax: true,
    skipLibCheck: true,
  },
  include: ["src"],
};

const serverSource = `import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { createDrizzleOrderRepository } from "../adapters/db/order-repository.ts";
import { createDrizzlePetRepository } from "../adapters/db/pet-repository.ts";
import { createApp } from "./app.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const port = Number(process.env.PORT ?? "3000");
if (!Number.isInteger(port) || port < 1) throw new Error("PORT must be a positive integer");

const pool = new Pool({ connectionString });
const db = drizzle(pool);
const app = createApp({
  pets: createDrizzlePetRepository(db),
  orders: createDrizzleOrderRepository(db),
});

serve({ fetch: app.fetch, port }, ({ port: listeningPort }) => {
  console.log(\`Petstore listening on http://0.0.0.0:\${listeningPort}\`);
});
`;

const startupScript = `#!/bin/sh
set -eu

pnpm run migrate
exec pnpm start
`;

const dockerfile = `FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client \\
  && corepack enable \\
  && corepack prepare pnpm@11.18.0 --activate

COPY package.json ./
RUN pnpm install --prod

COPY . .
RUN chmod +x scripts/start.sh

EXPOSE 3000

CMD ["./scripts/start.sh"]
`;

const dockerCompose = `services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: petstore
      POSTGRES_USER: petstore
      POSTGRES_PASSWORD: petstore
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U petstore -d petstore"]
      interval: 2s
      timeout: 5s
      retries: 15
    volumes:
      - postgres-data:/var/lib/postgresql/data

  app:
    build: .
    environment:
      DATABASE_URL: postgres://petstore:petstore@postgres:5432/petstore
      PORT: "3000"
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3000:3000"

volumes:
  postgres-data:
`;

const dockerignore = `node_modules
dist
.git
`;

export function generatePackagingFiles(): GeneratedFile[] {
  return [
    {
      path: "package.json",
      contents: `${JSON.stringify(packageManifest, undefined, 2)}\n`,
      ownership: "generated",
    },
    {
      path: "tsconfig.json",
      contents: `${JSON.stringify(tsconfig, undefined, 2)}\n`,
      ownership: "generated",
    },
    {
      path: "src/runtime/server.ts",
      contents: serverSource,
      ownership: "generated",
    },
    {
      path: "scripts/start.sh",
      contents: startupScript,
      ownership: "generated",
    },
    {
      path: "Dockerfile",
      contents: dockerfile,
      ownership: "generated",
    },
    {
      path: "docker-compose.yml",
      contents: dockerCompose,
      ownership: "generated",
    },
    {
      path: ".dockerignore",
      contents: dockerignore,
      ownership: "generated",
    },
  ];
}

export function createPackagingPlugin(): HexkitPlugin {
  return {
    name: "packaging",
    generate(context) {
      for (const file of generatePackagingFiles()) {
        context.writeFile(file);
      }
    },
  };
}
