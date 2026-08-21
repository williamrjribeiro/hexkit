import { describe, expect, it } from "vite-plus/test";

import { renderDockerCompose, type ComposePlan } from "./compose.ts";

describe("Given a compose plan", () => {
  const postgresBlock = (databaseName: string) => `  postgres:
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
      - postgres-data:/var/lib/postgresql/data`;

  it("when the app service is Hono, then compose names the service app without a healthcheck", () => {
    const plan: ComposePlan = {
      databaseName: "hexkit_library_api",
      appService: { name: "app" },
    };

    const yaml = renderDockerCompose(plan);

    expect(yaml).toContain(postgresBlock("hexkit_library_api"));
    expect(yaml).toContain("  app:\n    build: .");
    expect(yaml).not.toContain("  next:");
    expect(yaml).not.toContain("HOSTNAME");
    expect(yaml).not.toContain("start_period");
    expect(yaml).toMatchInlineSnapshot(`
      "services:
        postgres:
          image: postgres:17-alpine
          environment:
            POSTGRES_DB: \${POSTGRES_DB:-hexkit_library_api}
            POSTGRES_USER: \${POSTGRES_USER:-hexkit_library_api}
            POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-hexkit_library_api}
          healthcheck:
            test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
            interval: 2s
            timeout: 5s
            retries: 15
          volumes:
            - postgres-data:/var/lib/postgresql/data

        app:
          build: .
          environment:
            DATABASE_URL: postgres://\${POSTGRES_USER:-hexkit_library_api}:\${POSTGRES_PASSWORD:-hexkit_library_api}@postgres:5432/\${POSTGRES_DB:-hexkit_library_api}
            PORT: "3000"
          depends_on:
            postgres:
              condition: service_healthy
          ports:
            - "3000:3000"

      volumes:
        postgres-data:
      "
    `);
  });

  it("when the app service is Next, then compose names the service next with a healthcheck", () => {
    const plan: ComposePlan = {
      databaseName: "hexkit_catalog_api",
      appService: {
        name: "next",
        healthcheck: {
          test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/"],
          startPeriod: "45s",
        },
      },
    };

    const yaml = renderDockerCompose(plan);

    expect(yaml).toContain(postgresBlock("hexkit_catalog_api"));
    expect(yaml).toContain("  next:\n    build: .");
    expect(yaml).toContain('HOSTNAME: "0.0.0.0"');
    expect(yaml).not.toContain("  app:");
    expect(yaml).toMatchInlineSnapshot(`
      "services:
        postgres:
          image: postgres:17-alpine
          environment:
            POSTGRES_DB: \${POSTGRES_DB:-hexkit_catalog_api}
            POSTGRES_USER: \${POSTGRES_USER:-hexkit_catalog_api}
            POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-hexkit_catalog_api}
          healthcheck:
            test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
            interval: 2s
            timeout: 5s
            retries: 15
          volumes:
            - postgres-data:/var/lib/postgresql/data

        next:
          build: .
          environment:
            DATABASE_URL: postgres://\${POSTGRES_USER:-hexkit_catalog_api}:\${POSTGRES_PASSWORD:-hexkit_catalog_api}@postgres:5432/\${POSTGRES_DB:-hexkit_catalog_api}
            HOSTNAME: "0.0.0.0"
            PORT: "3000"
          depends_on:
            postgres:
              condition: service_healthy
          ports:
            - "3000:3000"
          healthcheck:
            test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/"]
            interval: 2s
            timeout: 5s
            retries: 30
            start_period: 45s

      volumes:
        postgres-data:
      "
    `);
  });

  it("when a healthcheck omits startPeriod, then compose does not emit start_period", () => {
    const yaml = renderDockerCompose({
      databaseName: "catalog_api",
      appService: {
        name: "next",
        healthcheck: {
          test: ["CMD", "true"],
        },
      },
    });

    expect(yaml).toContain('test: ["CMD", "true"]');
    expect(yaml).not.toContain("start_period");
  });
});
