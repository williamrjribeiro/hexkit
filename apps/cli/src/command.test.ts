import { describe, expect, it } from "vite-plus/test";

import type { GeneratedFile } from "@hexkit/plugin-api";

import { createDefaultPlugins, createPackagingPlugin, parseArguments, runCli } from "./index.ts";

describe("Given a Hexkit CLI invocation", () => {
  it("when help is requested, then it prints the snapshotted command help and succeeds", () => {
    const messages: string[] = [];

    const exitCode = runCli(["--help"], {
      generate() {
        throw new Error("help must not generate");
      },
      log(text) {
        messages.push(text);
      },
    });

    expect(exitCode).toBe(0);
    expect(messages).toMatchInlineSnapshot(`
      [
        "Hexkit

      Usage:
        hexkit generate <openapi> <output>
        hexkit --help

      Commands:
        generate  Generate a compose-ready application from an OpenAPI document

      Options:
        -h, --help  Show this help",
      ]
    `);
  });

  it("when generate has no OpenAPI input, then it reports a clear error and fails", () => {
    const messages: string[] = [];

    const exitCode = runCli(["generate"], {
      generate() {
        throw new Error("invalid arguments must not generate");
      },
      log(text) {
        messages.push(text);
      },
    });

    expect(exitCode).toBe(1);
    expect(messages[0]).toBe("Error: Missing OpenAPI input path.");
    expect(messages[1]).toContain("hexkit generate <openapi> <output>");
  });

  it("when generate receives an input and output, then it invokes generation exactly once", () => {
    const calls: Array<{ inputPath: string; outputDirectory: string }> = [];

    const exitCode = runCli(["generate", "petstore.yaml", "generated/petstore"], {
      generate(inputPath, outputDirectory) {
        calls.push({ inputPath, outputDirectory });
      },
      log() {},
    });

    expect(exitCode).toBe(0);
    expect(calls).toEqual([
      {
        inputPath: "petstore.yaml",
        outputDirectory: "generated/petstore",
      },
    ]);
  });

  it("when arguments are parsed, then parsing is a pure command calculation", () => {
    expect(parseArguments(["generate", "petstore.yaml", "generated/petstore"])).toEqual({
      kind: "generate",
      inputPath: "petstore.yaml",
      outputDirectory: "generated/petstore",
    });
  });
});

describe("Given the default generation pipeline", () => {
  it("when plugins are selected, then Apical, hexagonal, Hono, Drizzle, and packaging are ordered", () => {
    expect(createDefaultPlugins().map((plugin) => plugin.name)).toEqual([
      "apical",
      "architecture-hexagonal",
      "hono",
      "drizzle",
      "packaging",
    ]);
  });
});

describe("Given compose-ready generated packaging", () => {
  it("when the packaging plugin runs, then it emits the snapshotted container and startup paths", () => {
    const files: GeneratedFile[] = [];

    createPackagingPlugin().generate({
      inputPath: "petstore.yaml",
      outputDirectory: "generated/petstore",
      writeFile(file) {
        files.push(file);
      },
      log() {},
    });

    expect(files.map(({ path, ownership }) => ({ path, ownership }))).toMatchInlineSnapshot(`
      [
        {
          "ownership": "generated",
          "path": "package.json",
        },
        {
          "ownership": "generated",
          "path": "tsconfig.json",
        },
        {
          "ownership": "generated",
          "path": "src/runtime/server.ts",
        },
        {
          "ownership": "generated",
          "path": "scripts/start.sh",
        },
        {
          "ownership": "generated",
          "path": "Dockerfile",
        },
        {
          "ownership": "generated",
          "path": "docker-compose.yml",
        },
        {
          "ownership": "generated",
          "path": ".dockerignore",
        },
      ]
    `);

    const compose = files.find((file) => file.path === "docker-compose.yml");
    expect(compose?.contents).toMatchInlineSnapshot(`
      "services:
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
      "
    `);
  });

  it("when the package manifest is emitted, then source build and runtime dependencies use current versions", () => {
    const files: GeneratedFile[] = [];

    createPackagingPlugin().generate({
      inputPath: "petstore.yaml",
      outputDirectory: "generated/petstore",
      writeFile(file) {
        files.push(file);
      },
      log() {},
    });

    const packageFile = files.find((file) => file.path === "package.json");
    expect(packageFile).toBeDefined();
    const manifest = JSON.parse(packageFile?.contents ?? "") as {
      dependencies: Record<string, string>;
    };

    expect(manifest.dependencies).toEqual({
      "@hono/node-server": "2.0.12",
      "@standard-schema/spec": "1.1.0",
      "drizzle-orm": "0.45.2",
      hono: "4.13.0",
      pg: "8.22.0",
      zod: "4.4.3",
    });
  });

  it("when TypeScript config is emitted, then it remains compatible with Apical generated imports", () => {
    const files: GeneratedFile[] = [];

    createPackagingPlugin().generate({
      inputPath: "petstore.yaml",
      outputDirectory: "generated/petstore",
      writeFile(file) {
        files.push(file);
      },
      log() {},
    });

    const tsconfigFile = files.find((file) => file.path === "tsconfig.json");
    expect(tsconfigFile).toBeDefined();
    const tsconfig = JSON.parse(tsconfigFile?.contents ?? "") as {
      compilerOptions: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions).not.toHaveProperty("noUnusedLocals");
  });
});
