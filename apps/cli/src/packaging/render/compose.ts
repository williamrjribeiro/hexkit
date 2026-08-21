import type { ComposePlan } from "../model/plan.ts";

export type { ComposePlan };

export function renderDockerCompose(plan: ComposePlan): string {
  const { databaseName, appService } = plan;
  const hostnameEnvironment = appService.name === "next" ? `\n      HOSTNAME: "0.0.0.0"` : "";
  const healthcheck =
    appService.healthcheck === undefined ? "" : renderAppHealthcheck(appService.healthcheck);

  return `services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-${databaseName}}
      POSTGRES_USER: \${POSTGRES_USER:-${databaseName}}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-${databaseName}}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 2s
      timeout: 5s
      retries: 15
    volumes:
      - postgres-data:/var/lib/postgresql/data

  ${appService.name}:
    build: .
    environment:
      DATABASE_URL: postgres://\${POSTGRES_USER:-${databaseName}}:\${POSTGRES_PASSWORD:-${databaseName}}@postgres:5432/\${POSTGRES_DB:-${databaseName}}${hostnameEnvironment}
      PORT: "3000"
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3000:3000"${healthcheck}

volumes:
  postgres-data:
`;
}

function renderAppHealthcheck(healthcheck: {
  test: readonly string[];
  startPeriod?: string;
}): string {
  const test = `[${healthcheck.test.map((part) => JSON.stringify(part)).join(", ")}]`;
  const startPeriod =
    healthcheck.startPeriod === undefined ? "" : `\n      start_period: ${healthcheck.startPeriod}`;

  return `
    healthcheck:
      test: ${test}
      interval: 2s
      timeout: 5s
      retries: 30${startPeriod}`;
}
