import { createAddPet } from "../../core/application/add-pet.ts";
import { createDeleteOrder } from "../../core/application/delete-order.ts";
import { createDeletePet } from "../../core/application/delete-pet.ts";
import { createFindPetsByStatus } from "../../core/application/find-pets-by-status.ts";
import { createFindPetsByTags } from "../../core/application/find-pets-by-tags.ts";
import { createGetOrderById } from "../../core/application/get-order-by-id.ts";
import { createGetPetById } from "../../core/application/get-pet-by-id.ts";
import { createPlaceOrder } from "../../core/application/place-order.ts";
import { createUpdatePetWithForm } from "../../core/application/update-pet-with-form.ts";
import { createUpdatePet } from "../../core/application/update-pet.ts";
import type { Authenticator } from "../../core/ports/authenticator.ts";
import type { OrderRepository } from "../../core/ports/order-repository.ts";
import type { PetRepository } from "../../core/ports/pet-repository.ts";
import { createInMemoryAuthenticator } from "../auth/in-memory-authenticator.ts";
import { getDatabase } from "../db/database.ts";
import { createDrizzleOrderRepository } from "../db/order-repository.ts";
import { createDrizzlePetRepository } from "../db/pet-repository.ts";
import { createHttpControllers } from "./controllers.ts";
import type { HttpControllers } from "./controllers.ts";

export type RuntimeRepositories = {
  orders: OrderRepository;
  pets: PetRepository;
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
    deleteOrder: createDeleteOrder(repositories.orders),
    deletePet: createDeletePet(repositories.pets),
    findPetsByStatus: createFindPetsByStatus(repositories.pets),
    findPetsByTags: createFindPetsByTags(repositories.pets),
    getOrderById: createGetOrderById(repositories.orders),
    getPetById: createGetPetById(repositories.pets),
    placeOrder: createPlaceOrder(repositories.orders),
    updatePet: createUpdatePet(repositories.pets),
    updatePetWithForm: createUpdatePetWithForm(repositories.pets),
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
