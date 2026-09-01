import { AddPet, createAddPet } from "../../core/application/add-pet.ts";
import { DeleteOrder, createDeleteOrder } from "../../core/application/delete-order.ts";
import { DeletePet, createDeletePet } from "../../core/application/delete-pet.ts";
import { FindPetsByStatus, createFindPetsByStatus } from "../../core/application/find-pets-by-status.ts";
import { FindPetsByTags, createFindPetsByTags } from "../../core/application/find-pets-by-tags.ts";
import { GetOrderById, createGetOrderById } from "../../core/application/get-order-by-id.ts";
import { createGetPetById } from "../../core/application/get-pet-by-id.ts";
import { PlaceOrder, createPlaceOrder } from "../../core/application/place-order.ts";
import { UpdatePetWithForm, createUpdatePetWithForm } from "../../core/application/update-pet-with-form.ts";
import { UpdatePet, createUpdatePet } from "../../core/application/update-pet.ts";
import type { Principal } from "../../core/domain/auth-principal.ts";
import type { Pet } from "../../core/domain/pet.ts";
import type { OrderRepository } from "../../core/ports/order-repository.ts";
import type { PetRepository } from "../../core/ports/pet-repository.ts";
import { getDatabase } from "../db/database.ts";
import { createDrizzleOrderRepository } from "../db/order-repository.ts";
import { createDrizzlePetRepository } from "../db/pet-repository.ts";

export type RuntimeRepositories = {
  orders: OrderRepository;
  pets: PetRepository;
};

export type ServerAccess = {
  addPet: AddPet;
  deleteOrder: DeleteOrder;
  deletePet: DeletePet;
  findPetsByStatus: FindPetsByStatus;
  findPetsByTags: FindPetsByTags;
  getOrderById: GetOrderById;
  getPetById: (petId: number) => Promise<Pet | undefined>;
  placeOrder: PlaceOrder;
  updatePet: UpdatePet;
  updatePetWithForm: UpdatePetWithForm;
};

let cachedRepositories: RuntimeRepositories | undefined;

let cachedAccess: ServerAccess | undefined;

const rscPrincipal: Principal = { id: "rsc", scheme: "in-process", scopes: [] };

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

function composeServerAccess(repositories: RuntimeRepositories): ServerAccess {
  return {
    addPet: createAddPet(repositories.pets),
    deleteOrder: createDeleteOrder(repositories.orders),
    deletePet: createDeletePet(repositories.pets),
    findPetsByStatus: createFindPetsByStatus(repositories.pets),
    findPetsByTags: createFindPetsByTags(repositories.pets),
    getOrderById: createGetOrderById(repositories.orders),
    getPetById: (petId) => createGetPetById(repositories.pets)(rscPrincipal, petId),
    placeOrder: createPlaceOrder(repositories.orders),
    updatePet: createUpdatePet(repositories.pets),
    updatePetWithForm: createUpdatePetWithForm(repositories.pets),
  };
}

export function getServerAccess(): ServerAccess {
  if (cachedAccess === undefined) {
    cachedAccess = composeServerAccess(getRepositories());
  }
  return cachedAccess;
}
