import type { AddPet } from "../../core/application/add-pet.ts";
import type { CreateUser } from "../../core/application/create-user.ts";
import type { CreateUsersWithListInput } from "../../core/application/create-users-with-list-input.ts";
import type { DeleteOrder } from "../../core/application/delete-order.ts";
import type { DeletePet } from "../../core/application/delete-pet.ts";
import type { DeleteUser } from "../../core/application/delete-user.ts";
import type { FindPetsByStatus } from "../../core/application/find-pets-by-status.ts";
import type { FindPetsByTags } from "../../core/application/find-pets-by-tags.ts";
import type { GetOrderById } from "../../core/application/get-order-by-id.ts";
import type { GetPetById } from "../../core/application/get-pet-by-id.ts";
import type { GetUserByName } from "../../core/application/get-user-by-name.ts";
import type { LoginUser } from "../../core/application/login-user.ts";
import type { LogoutUser } from "../../core/application/logout-user.ts";
import type { PlaceOrder } from "../../core/application/place-order.ts";
import type { UpdatePetWithForm } from "../../core/application/update-pet-with-form.ts";
import type { UpdatePet } from "../../core/application/update-pet.ts";
import type { UpdateUser } from "../../core/application/update-user.ts";
import type { Principal } from "../../core/domain/auth-principal.ts";
import type { Authenticator } from "../../core/ports/authenticator.ts";
import { addPetResponseMap } from "../../generated/contracts/routes/addPet.ts";
import { createUserResponseMap } from "../../generated/contracts/routes/createUser.ts";
import { createUsersWithListInputResponseMap } from "../../generated/contracts/routes/createUsersWithListInput.ts";
import { findPetsByStatusResponseMap } from "../../generated/contracts/routes/findPetsByStatus.ts";
import { findPetsByTagsResponseMap } from "../../generated/contracts/routes/findPetsByTags.ts";
import { getOrderByIdResponseMap } from "../../generated/contracts/routes/getOrderById.ts";
import { getPetByIdResponseMap } from "../../generated/contracts/routes/getPetById.ts";
import { getUserByNameResponseMap } from "../../generated/contracts/routes/getUserByName.ts";
import { loginUserResponseMap } from "../../generated/contracts/routes/loginUser.ts";
import { placeOrderResponseMap } from "../../generated/contracts/routes/placeOrder.ts";
import { updatePetResponseMap } from "../../generated/contracts/routes/updatePet.ts";
import { updatePetWithFormResponseMap } from "../../generated/contracts/routes/updatePetWithForm.ts";
import { updateUserResponseMap } from "../../generated/contracts/routes/updateUser.ts";
import { addPetWrapper } from "../../generated/contracts/server/addPet.ts";
import { createUserWrapper } from "../../generated/contracts/server/createUser.ts";
import { createUsersWithListInputWrapper } from "../../generated/contracts/server/createUsersWithListInput.ts";
import { deleteOrderWrapper } from "../../generated/contracts/server/deleteOrder.ts";
import { deletePetWrapper } from "../../generated/contracts/server/deletePet.ts";
import { deleteUserWrapper } from "../../generated/contracts/server/deleteUser.ts";
import { findPetsByStatusWrapper } from "../../generated/contracts/server/findPetsByStatus.ts";
import { findPetsByTagsWrapper } from "../../generated/contracts/server/findPetsByTags.ts";
import { getOrderByIdWrapper } from "../../generated/contracts/server/getOrderById.ts";
import { getPetByIdWrapper } from "../../generated/contracts/server/getPetById.ts";
import { getUserByNameWrapper } from "../../generated/contracts/server/getUserByName.ts";
import { loginUserWrapper } from "../../generated/contracts/server/loginUser.ts";
import { logoutUserWrapper } from "../../generated/contracts/server/logoutUser.ts";
import { placeOrderWrapper } from "../../generated/contracts/server/placeOrder.ts";
import { updatePetWrapper } from "../../generated/contracts/server/updatePet.ts";
import { updatePetWithFormWrapper } from "../../generated/contracts/server/updatePetWithForm.ts";
import { updateUserWrapper } from "../../generated/contracts/server/updateUser.ts";

export type HttpUseCases = {
  addPet: AddPet;
  createUser: CreateUser;
  createUsersWithListInput: CreateUsersWithListInput;
  deleteOrder: DeleteOrder;
  deletePet: DeletePet;
  deleteUser: DeleteUser;
  findPetsByStatus: FindPetsByStatus;
  findPetsByTags: FindPetsByTags;
  getOrderById: GetOrderById;
  getPetById: GetPetById;
  getUserByName: GetUserByName;
  loginUser: LoginUser;
  logoutUser: LogoutUser;
  placeOrder: PlaceOrder;
  updatePet: UpdatePet;
  updatePetWithForm: UpdatePetWithForm;
  updateUser: UpdateUser;
};

export class RequestValidationError extends Error {
  constructor(kind: string) {
    super(`Invalid HTTP request: ${kind}`);
    this.name = "RequestValidationError";
  }
}

type ControllerRequest<TController> = TController extends (request: infer Request) => Promise<unknown> ? Request : never;

export class AuthenticationError extends Error {
  constructor(kind: string) {
    super(`Authentication failed: ${kind}`);
    this.name = "AuthenticationError";
  }
}

export function createHttpControllers(useCases: HttpUseCases, authenticator?: Authenticator) {
  if (authenticator === undefined) {
    throw new AuthenticationError("authenticator-missing");
  }
  return {
    addPet: addPetWrapper(async (request) => {
      if (!request.isValid || !request.value.body) {
        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);
      }
      const result = await useCases.addPet(request.value.body);
      return {
        status: "201",
        contentType: "application/json",
        data: addPetResponseMap["201"]["application/json"].parse(result),
      };
    }),
    createUser: createUserWrapper(async (request) => {
      if (!request.isValid || !request.value.body) {
        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);
      }
      const result = await useCases.createUser(request.value.body);
      return {
        status: "201",
        contentType: "application/json",
        data: createUserResponseMap["201"]["application/json"].parse(result),
      };
    }),
    createUsersWithListInput: createUsersWithListInputWrapper(async (request) => {
      if (!request.isValid || !request.value.body) {
        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);
      }
      const result = await useCases.createUsersWithListInput(request.value.body);
      return {
        status: "200",
        contentType: "application/json",
        data: createUsersWithListInputResponseMap["200"]["application/json"].parse(result),
      };
    }),
    deleteOrder: deleteOrderWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      await useCases.deleteOrder(request.value.path.orderId);
      return { status: "204" };
    }),
    deletePet: deletePetWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      await useCases.deletePet(request.value.path.petId);
      return { status: "204" };
    }),
    deleteUser: deleteUserWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      const result = await useCases.deleteUser(request.value.path.username);
      if (!result) return { status: "404" };
      return { status: "204" };
    }),
    findPetsByStatus: findPetsByStatusWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      const result = await useCases.findPetsByStatus(request.value.query?.status);
      return {
        status: "200",
        contentType: "application/json",
        data: findPetsByStatusResponseMap["200"]["application/json"].parse(result),
      };
    }),
    findPetsByTags: findPetsByTagsWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      const result = await useCases.findPetsByTags(request.value.query?.tags);
      return {
        status: "200",
        contentType: "application/json",
        data: findPetsByTagsResponseMap["200"]["application/json"].parse(result),
      };
    }),
    getOrderById: getOrderByIdWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      const result = await useCases.getOrderById(request.value.path.orderId);
      if (!result) return { status: "404" };
      return {
        status: "200",
        contentType: "application/json",
        data: getOrderByIdResponseMap["200"]["application/json"].parse(result),
      };
    }),
    getPetById: async (
      request: ControllerRequest<ReturnType<typeof getPetByIdWrapper>>,
      principal: Principal,
    ) => getPetByIdWrapper(async (request) => {
      if (!request.isValid) {
        if (!request.isValid && request.kind === "headers-error") {
          throw new AuthenticationError(request.kind);
        }
        throw new RequestValidationError(request.kind);
      }
      const result = await useCases.getPetById(principal, request.value.path.petId);
      if (!result) return { status: "404" };
      return {
        status: "200",
        contentType: "application/json",
        data: getPetByIdResponseMap["200"]["application/json"].parse(result),
      };
    })(request),
    getUserByName: getUserByNameWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      const result = await useCases.getUserByName(request.value.path.username);
      if (!result) return { status: "404" };
      return {
        status: "200",
        contentType: "application/json",
        data: getUserByNameResponseMap["200"]["application/json"].parse(result),
      };
    }),
    loginUser: loginUserWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      const result = await useCases.loginUser(request.value.query?.username, request.value.query?.password);
      return {
        status: "200",
        contentType: "application/json",
        data: loginUserResponseMap["200"]["application/json"].parse(result.data),
        headers: result.headers,
      };
    }),
    logoutUser: logoutUserWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      await useCases.logoutUser();
      return { status: "200" };
    }),
    placeOrder: placeOrderWrapper(async (request) => {
      if (!request.isValid || !request.value.body) {
        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);
      }
      const result = await useCases.placeOrder(request.value.body);
      return {
        status: "201",
        contentType: "application/json",
        data: placeOrderResponseMap["201"]["application/json"].parse(result),
      };
    }),
    updatePet: updatePetWrapper(async (request) => {
      if (!request.isValid || !request.value.body) {
        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);
      }
      const result = await useCases.updatePet(request.value.body);
      return {
        status: "200",
        contentType: "application/json",
        data: updatePetResponseMap["200"]["application/json"].parse(result),
      };
    }),
    updatePetWithForm: updatePetWithFormWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      const result = await useCases.updatePetWithForm(request.value.path.petId, request.value.query?.name, request.value.query?.status);
      if (!result) return { status: "404" };
      return {
        status: "200",
        contentType: "application/json",
        data: updatePetWithFormResponseMap["200"]["application/json"].parse(result),
      };
    }),
    updateUser: updateUserWrapper(async (request) => {
      if (!request.isValid || !request.value.body) {
        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);
      }
      const result = await useCases.updateUser(request.value.path.username, request.value.body);
      if (!result) return { status: "404" };
      return {
        status: "200",
        contentType: "application/json",
        data: updateUserResponseMap["200"]["application/json"].parse(result),
      };
    })
  };
}

export type HttpControllers = ReturnType<typeof createHttpControllers>;
