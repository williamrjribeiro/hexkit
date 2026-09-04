import { AddPet, createAddPet } from "../../core/application/add-pet.ts";
import { CreateUser, createCreateUser } from "../../core/application/create-user.ts";
import { CreateUsersWithListInput, createCreateUsersWithListInput } from "../../core/application/create-users-with-list-input.ts";
import { DeleteOrder, createDeleteOrder } from "../../core/application/delete-order.ts";
import { DeletePet, createDeletePet } from "../../core/application/delete-pet.ts";
import { DeleteUser, createDeleteUser } from "../../core/application/delete-user.ts";
import { FindPetsByStatus, createFindPetsByStatus } from "../../core/application/find-pets-by-status.ts";
import { FindPetsByTags, createFindPetsByTags } from "../../core/application/find-pets-by-tags.ts";
import { GetOrderById, createGetOrderById } from "../../core/application/get-order-by-id.ts";
import { createGetPetById } from "../../core/application/get-pet-by-id.ts";
import { GetUserByName, createGetUserByName } from "../../core/application/get-user-by-name.ts";
import { LoginUser, createLoginUser } from "../../core/application/login-user.ts";
import { LogoutUser, createLogoutUser } from "../../core/application/logout-user.ts";
import { PlaceOrder, createPlaceOrder } from "../../core/application/place-order.ts";
import { UpdatePetWithForm, createUpdatePetWithForm } from "../../core/application/update-pet-with-form.ts";
import { UpdatePet, createUpdatePet } from "../../core/application/update-pet.ts";
import { UpdateUser, createUpdateUser } from "../../core/application/update-user.ts";
import type { Principal } from "../../core/domain/auth-principal.ts";
import type { Pet } from "../../core/domain/pet.ts";
import type { OrderRepository } from "../../core/ports/order-repository.ts";
import type { PetRepository } from "../../core/ports/pet-repository.ts";
import type { UserRepository } from "../../core/ports/user-repository.ts";
import { getDatabase } from "../db/database.ts";
import { createDrizzleOrderRepository } from "../db/order-repository.ts";
import { createDrizzlePetRepository } from "../db/pet-repository.ts";
import { createDrizzleUserRepository } from "../db/user-repository.ts";

export type RuntimeRepositories = {
  orders: OrderRepository;
  pets: PetRepository;
  users: UserRepository;
};

export type ServerAccess = {
  addPet: AddPet;
  createUser: CreateUser;
  createUsersWithListInput: CreateUsersWithListInput;
  deleteOrder: DeleteOrder;
  deletePet: DeletePet;
  deleteUser: DeleteUser;
  findPetsByStatus: FindPetsByStatus;
  findPetsByTags: FindPetsByTags;
  getOrderById: GetOrderById;
  getPetById: (petId: number) => Promise<Pet | undefined>;
  getUserByName: GetUserByName;
  loginUser: LoginUser;
  logoutUser: LogoutUser;
  placeOrder: PlaceOrder;
  updatePet: UpdatePet;
  updatePetWithForm: UpdatePetWithForm;
  updateUser: UpdateUser;
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
    users: createDrizzleUserRepository(db),
    };
  }
  return cachedRepositories;
}

function composeServerAccess(repositories: RuntimeRepositories): ServerAccess {
  return {
    addPet: createAddPet(repositories.pets),
    createUser: createCreateUser(repositories.users),
    createUsersWithListInput: createCreateUsersWithListInput(repositories.users),
    deleteOrder: createDeleteOrder(repositories.orders),
    deletePet: createDeletePet(repositories.pets),
    deleteUser: createDeleteUser(repositories.users),
    findPetsByStatus: createFindPetsByStatus(repositories.pets),
    findPetsByTags: createFindPetsByTags(repositories.pets),
    getOrderById: createGetOrderById(repositories.orders),
    getPetById: (petId) => createGetPetById(repositories.pets)(rscPrincipal, petId),
    getUserByName: createGetUserByName(repositories.users),
    loginUser: createLoginUser(repositories.users),
    logoutUser: createLogoutUser(repositories.users),
    placeOrder: createPlaceOrder(repositories.orders),
    updatePet: createUpdatePet(repositories.pets),
    updatePetWithForm: createUpdatePetWithForm(repositories.pets),
    updateUser: createUpdateUser(repositories.users),
  };
}

export function getServerAccess(): ServerAccess {
  if (cachedAccess === undefined) {
    cachedAccess = composeServerAccess(getRepositories());
  }
  return cachedAccess;
}
