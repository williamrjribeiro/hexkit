import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { generateApplication } from "../../cli/src/main.ts";

describe("Given the canonical Petstore contract", () => {
  const contractPath = new URL("../openapi.poc.yaml", import.meta.url).pathname;
  const generatedDirectories: string[] = [];

  const requiredOutputPaths = [
    ".dockerignore",
    "Dockerfile",
    "docker-compose.yml",
    "drizzle/0000_hexkit-petstore-poc.sql",
    "package.json",
    "scripts/start.sh",
    "src/adapters/auth/in-memory-authenticator.ts",
    "src/adapters/db/mappers.ts",
    "src/adapters/db/order-repository.ts",
    "src/adapters/db/pet-repository.ts",
    "src/adapters/db/schema.ts",
    "src/adapters/db/user-repository.ts",
    "src/adapters/http/controllers.ts",
    "src/adapters/http/routes.ts",
    "src/core/application/add-pet.ts",
    "src/core/application/create-user.ts",
    "src/core/application/create-users-with-list-input.ts",
    "src/core/application/delete-order.ts",
    "src/core/application/delete-pet.ts",
    "src/core/application/delete-user.ts",
    "src/core/application/find-pets-by-status.ts",
    "src/core/application/find-pets-by-tags.ts",
    "src/core/application/get-order-by-id.ts",
    "src/core/application/get-pet-by-id.ts",
    "src/core/application/get-user-by-name.ts",
    "src/core/application/login-user.ts",
    "src/core/application/logout-user.ts",
    "src/core/application/place-order.ts",
    "src/core/application/update-pet-with-form.ts",
    "src/core/application/update-pet.ts",
    "src/core/application/update-user.ts",
    "src/core/domain/auth-principal.ts",
    "src/core/domain/category.ts",
    "src/core/domain/order.ts",
    "src/core/domain/pet.ts",
    "src/core/domain/tag.ts",
    "src/core/domain/user.ts",
    "src/core/ports/authenticator.ts",
    "src/core/ports/order-repository.ts",
    "src/core/ports/pet-repository.ts",
    "src/core/ports/user-repository.ts",
    "src/generated/contracts/hexkit-contract.json",
    "src/generated/contracts/package.json",
    "src/generated/contracts/routes/addPet.ts",
    "src/generated/contracts/routes/createUser.ts",
    "src/generated/contracts/routes/createUsersWithListInput.ts",
    "src/generated/contracts/routes/deleteOrder.ts",
    "src/generated/contracts/routes/deletePet.ts",
    "src/generated/contracts/routes/deleteUser.ts",
    "src/generated/contracts/routes/findPetsByStatus.ts",
    "src/generated/contracts/routes/findPetsByTags.ts",
    "src/generated/contracts/routes/getOrderById.ts",
    "src/generated/contracts/routes/getPetById.ts",
    "src/generated/contracts/routes/getUserByName.ts",
    "src/generated/contracts/routes/index.ts",
    "src/generated/contracts/routes/loginUser.ts",
    "src/generated/contracts/routes/logoutUser.ts",
    "src/generated/contracts/routes/placeOrder.ts",
    "src/generated/contracts/routes/updatePet.ts",
    "src/generated/contracts/routes/updatePetWithForm.ts",
    "src/generated/contracts/routes/updateUser.ts",
    "src/generated/contracts/schemas/Category.ts",
    "src/generated/contracts/schemas/CreateUsersWithListInputRequest.ts",
    "src/generated/contracts/schemas/FindPetsByStatus200Response.ts",
    "src/generated/contracts/schemas/FindPetsByTags200Response.ts",
    "src/generated/contracts/schemas/LoginUser200Response.ts",
    "src/generated/contracts/schemas/Order.ts",
    "src/generated/contracts/schemas/Pet.ts",
    "src/generated/contracts/schemas/Tag.ts",
    "src/generated/contracts/schemas/User.ts",
    "src/generated/contracts/schemas/addPetParameters.ts",
    "src/generated/contracts/schemas/createUserParameters.ts",
    "src/generated/contracts/schemas/createUsersWithListInputParameters.ts",
    "src/generated/contracts/schemas/deleteOrderParameters.ts",
    "src/generated/contracts/schemas/deletePetParameters.ts",
    "src/generated/contracts/schemas/deleteUserParameters.ts",
    "src/generated/contracts/schemas/findPetsByStatusParameters.ts",
    "src/generated/contracts/schemas/findPetsByTagsParameters.ts",
    "src/generated/contracts/schemas/getOrderByIdParameters.ts",
    "src/generated/contracts/schemas/getPetByIdParameters.ts",
    "src/generated/contracts/schemas/getUserByNameParameters.ts",
    "src/generated/contracts/schemas/index.ts",
    "src/generated/contracts/schemas/loginUserParameters.ts",
    "src/generated/contracts/schemas/logoutUserParameters.ts",
    "src/generated/contracts/schemas/placeOrderParameters.ts",
    "src/generated/contracts/schemas/runtime.ts",
    "src/generated/contracts/schemas/updatePetParameters.ts",
    "src/generated/contracts/schemas/updatePetWithFormParameters.ts",
    "src/generated/contracts/schemas/updateUserParameters.ts",
    "src/generated/contracts/server/addPet.ts",
    "src/generated/contracts/server/createUser.ts",
    "src/generated/contracts/server/createUsersWithListInput.ts",
    "src/generated/contracts/server/deleteOrder.ts",
    "src/generated/contracts/server/deletePet.ts",
    "src/generated/contracts/server/deleteUser.ts",
    "src/generated/contracts/server/findPetsByStatus.ts",
    "src/generated/contracts/server/findPetsByTags.ts",
    "src/generated/contracts/server/getOrderById.ts",
    "src/generated/contracts/server/getPetById.ts",
    "src/generated/contracts/server/getUserByName.ts",
    "src/generated/contracts/server/index.ts",
    "src/generated/contracts/server/loginUser.ts",
    "src/generated/contracts/server/logoutUser.ts",
    "src/generated/contracts/server/placeOrder.ts",
    "src/generated/contracts/server/updatePet.ts",
    "src/generated/contracts/server/updatePetWithForm.ts",
    "src/generated/contracts/server/updateUser.ts",
    "src/generated/contracts/standard-schema.ts",
    "src/generated/contracts/tsconfig.json",
    "src/runtime/app.ts",
    "src/runtime/server.ts",
    "tsconfig.json",
  ] as const;

  afterEach(() => {
    for (const directory of generatedDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function createOutputDirectory(): string {
    const directory = mkdtempSync(join(tmpdir(), "hexkit-dogfood-"));
    generatedDirectories.push(directory);
    return directory;
  }

  function listFiles(root: string, directory = root): string[] {
    return readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)];
      })
      .sort();
  }

  async function generate(outputDirectory: string, logs: string[] = []): Promise<void> {
    await generateApplication(contractPath, outputDirectory, {
      actions: {
        exists: existsSync,
        write(path: string, contents: string) {
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, contents, "utf8");
        },
        log(message: string) {
          logs.push(message);
        },
      },
    });
  }

  it("when the real generator runs, then it emits every required application path", async () => {
    const outputDirectory = createOutputDirectory();

    await generate(outputDirectory);

    expect(listFiles(outputDirectory)).toEqual(requiredOutputPaths);
    expect(readFileSync(join(outputDirectory, "src/core/application/get-pet-by-id.ts"), "utf8")).toContain(
      "principal: Principal",
    );
    const userRepository = readFileSync(
      join(outputDirectory, "src/adapters/db/user-repository.ts"),
      "utf8",
    );
    const routes = readFileSync(join(outputDirectory, "src/adapters/http/routes.ts"), "utf8");
    const controllers = readFileSync(
      join(outputDirectory, "src/adapters/http/controllers.ts"),
      "utf8",
    );
    const schema = readFileSync(join(outputDirectory, "src/adapters/db/schema.ts"), "utf8");
    const updateUser = readFileSync(
      join(outputDirectory, "src/core/application/update-user.ts"),
      "utf8",
    );
    expect(schema).toContain('export const users = pgTable("users"');
    expect(userRepository).toContain("eq(users.username, username)");
    expect(userRepository).toContain("async loginUser(): Promise<{ data: string;");
    expect(userRepository).toContain(".values(body).returning()");
    expect(userRepository).toContain(
      'return { data: "", headers: { "x-rate-limit": 0, "x-expires-after": "" } }',
    );
    expect(userRepository).toContain("return row !== undefined");
    expect(updateUser).toContain("username: string, user: User");
    expect(controllers).toContain("request.value.path.username, request.value.body");
    expect(controllers).toContain("headers: result.headers");
    expect(routes.indexOf('app.get("/user/login"')).toBeLessThan(
      routes.indexOf('app.get("/user/:username"'),
    );
    expect(routes.indexOf('app.get("/user/logout"')).toBeLessThan(
      routes.indexOf('app.get("/user/:username"'),
    );
    expect(routes.indexOf('app.post("/user/createWithList"')).toBeLessThan(
      routes.indexOf('app.get("/user/:username"'),
    );
  });

  it("when the real generator runs, then the deployable manifest matches the dogfood contract", async () => {
    const outputDirectory = createOutputDirectory();

    await generate(outputDirectory);

    const manifest = JSON.parse(readFileSync(join(outputDirectory, "package.json"), "utf8"));
    expect(manifest).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "@hono/node-server": "2.0.12",
          "@standard-schema/spec": "1.1.0",
          "drizzle-orm": "0.45.2",
          "hono": "4.13.0",
          "pg": "8.22.0",
          "zod": "4.4.3",
        },
        "devDependencies": {
          "@types/node": "26.1.2",
          "@types/pg": "8.20.3",
          "typescript": "7.0.2",
        },
        "engines": {
          "node": ">=24.18.1",
        },
        "name": "generated-hexkit-petstore-poc",
        "packageManager": "pnpm@11.24.0",
        "private": true,
        "scripts": {
          "check": "tsc --noEmit",
          "migrate": "psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/0000_hexkit-petstore-poc.sql",
          "start": "node src/runtime/server.ts",
        },
        "type": "module",
        "version": "0.0.0",
      }
    `);
  });

  it("when a protected use case is hand-edited and regenerated, then the edit survives with a skip log", async () => {
    const outputDirectory = createOutputDirectory();
    const protectedPath = join(outputDirectory, "src/core/application/add-pet.ts");
    const handEdit = `// Deliberate dogfood customization.
export const protectedUseCase = "survives regeneration";
`;
    const logs: string[] = [];
    await generate(outputDirectory);
    writeFileSync(protectedPath, handEdit, "utf8");

    await generate(outputDirectory, logs);

    expect({
      contents: readFileSync(protectedPath, "utf8"),
      protectedLogs: logs.filter((message) => message.includes("protected")),
    }).toMatchInlineSnapshot(`
      {
        "contents": "// Deliberate dogfood customization.
      export const protectedUseCase = "survives regeneration";
      ",
        "protectedLogs": [
          "Skipped existing protected file: src/core/application/add-pet.ts",
          "Skipped existing protected file: src/core/application/create-user.ts",
          "Skipped existing protected file: src/core/application/create-users-with-list-input.ts",
          "Skipped existing protected file: src/core/application/delete-order.ts",
          "Skipped existing protected file: src/core/application/delete-pet.ts",
          "Skipped existing protected file: src/core/application/delete-user.ts",
          "Skipped existing protected file: src/core/application/find-pets-by-status.ts",
          "Skipped existing protected file: src/core/application/find-pets-by-tags.ts",
          "Skipped existing protected file: src/core/application/get-order-by-id.ts",
          "Skipped existing protected file: src/core/application/get-pet-by-id.ts",
          "Skipped existing protected file: src/core/application/get-user-by-name.ts",
          "Skipped existing protected file: src/core/application/login-user.ts",
          "Skipped existing protected file: src/core/application/logout-user.ts",
          "Skipped existing protected file: src/core/application/place-order.ts",
          "Skipped existing protected file: src/core/application/update-pet.ts",
          "Skipped existing protected file: src/core/application/update-pet-with-form.ts",
          "Skipped existing protected file: src/core/application/update-user.ts",
        ],
      }
    `);
  });
});
