import { createAddPet } from "../../core/application/add-pet.ts";
import { createCreateUser } from "../../core/application/create-user.ts";
import { createCreateUsersWithListInput } from "../../core/application/create-users-with-list-input.ts";
import { createDeleteOrder } from "../../core/application/delete-order.ts";
import { createDeletePet } from "../../core/application/delete-pet.ts";
import { createDeleteUser } from "../../core/application/delete-user.ts";
import { createFindPetsByStatus } from "../../core/application/find-pets-by-status.ts";
import { createFindPetsByTags } from "../../core/application/find-pets-by-tags.ts";
import { createGetOrderById } from "../../core/application/get-order-by-id.ts";
import { createGetPetById } from "../../core/application/get-pet-by-id.ts";
import { createGetUserByName } from "../../core/application/get-user-by-name.ts";
import { createLoginUser } from "../../core/application/login-user.ts";
import { createLogoutUser } from "../../core/application/logout-user.ts";
import { createPlaceOrder } from "../../core/application/place-order.ts";
import { createUpdatePetWithForm } from "../../core/application/update-pet-with-form.ts";
import { createUpdatePet } from "../../core/application/update-pet.ts";
import { createUpdateUser } from "../../core/application/update-user.ts";
import type { Authenticator } from "../../core/ports/authenticator.ts";
import type { OrderRepository } from "../../core/ports/order-repository.ts";
import type { PetRepository } from "../../core/ports/pet-repository.ts";
import type { UserRepository } from "../../core/ports/user-repository.ts";
import { createInMemoryAuthenticator } from "../auth/in-memory-authenticator.ts";
import { getDatabase } from "../db/database.ts";
import { createDrizzleOrderRepository } from "../db/order-repository.ts";
import { createDrizzlePetRepository } from "../db/pet-repository.ts";
import { createDrizzleUserRepository } from "../db/user-repository.ts";
import { createHttpControllers } from "./controllers.ts";
import type { HttpControllers } from "./controllers.ts";

export type RuntimeRepositories = {
  orders: OrderRepository;
  pets: PetRepository;
  users: UserRepository;
};

export type NextRuntime = {
  controllers: HttpControllers;
  repositories: RuntimeRepositories;
  authenticator: Authenticator;
};

let cachedRepositories: RuntimeRepositories | undefined;

let cachedRuntime: NextRuntime | undefined;

function getRepositories(): RuntimeRepositories {
  if (cachedRepositories === undefined) {
    const db = getDatabase();
    cachedRepositories = {
    orders: createDrizzleOrderRepository(db),
    pets: createDrizzlePetRepository(db),
    users: createDrizzleUserRepository(db),
    };
  }
  return cachedRepositories;
}

function createDefaultAuthenticator(): Authenticator {
  return createInMemoryAuthenticator({
    bearerTokens: new Set((process.env.AUTH_BEARER_TOKENS ?? "test-token").split(",")),
    apiKeys: new Map([["api_key", new Set((process.env.AUTH_API_KEYS ?? "test-key").split(","))]]),
  });
}

function composeRuntime(repositories: RuntimeRepositories, authenticator: Authenticator = createDefaultAuthenticator()): NextRuntime {
  return {
    controllers: createHttpControllers({
    addPet: createAddPet(repositories.pets),
    createUser: createCreateUser(repositories.users),
    createUsersWithListInput: createCreateUsersWithListInput(repositories.users),
    deleteOrder: createDeleteOrder(repositories.orders),
    deletePet: createDeletePet(repositories.pets),
    deleteUser: createDeleteUser(repositories.users),
    findPetsByStatus: createFindPetsByStatus(repositories.pets),
    findPetsByTags: createFindPetsByTags(repositories.pets),
    getOrderById: createGetOrderById(repositories.orders),
    getPetById: createGetPetById(repositories.pets),
    getUserByName: createGetUserByName(repositories.users),
    loginUser: createLoginUser(repositories.users),
    logoutUser: createLogoutUser(repositories.users),
    placeOrder: createPlaceOrder(repositories.orders),
    updatePet: createUpdatePet(repositories.pets),
    updatePetWithForm: createUpdatePetWithForm(repositories.pets),
    updateUser: createUpdateUser(repositories.users),
    }, authenticator),
    repositories,
    authenticator,
  };
}

export function getRuntime(): NextRuntime {
  if (cachedRuntime === undefined) {
    cachedRuntime = composeRuntime(getRepositories());
  }
  return cachedRuntime;
}
