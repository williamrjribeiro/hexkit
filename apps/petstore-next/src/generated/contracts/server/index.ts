/* Route imports for routes object */
import { route as addPetRoute } from "./addPet.ts";
import { route as updatePetRoute } from "./updatePet.ts";
import { route as getPetByIdRoute } from "./getPetById.ts";
import { route as updatePetWithFormRoute } from "./updatePetWithForm.ts";
import { route as deletePetRoute } from "./deletePet.ts";
import { route as findPetsByStatusRoute } from "./findPetsByStatus.ts";
import { route as findPetsByTagsRoute } from "./findPetsByTags.ts";
import { route as placeOrderRoute } from "./placeOrder.ts";
import { route as getOrderByIdRoute } from "./getOrderById.ts";
import { route as deleteOrderRoute } from "./deleteOrder.ts";
import { route as createUserRoute } from "./createUser.ts";
import { route as createUsersWithListInputRoute } from "./createUsersWithListInput.ts";
import { route as loginUserRoute } from "./loginUser.ts";
import { route as logoutUserRoute } from "./logoutUser.ts";
import { route as getUserByNameRoute } from "./getUserByName.ts";
import { route as updateUserRoute } from "./updateUser.ts";
import { route as deleteUserRoute } from "./deleteUser.ts";

/* Server operation wrappers */
export { addPetWrapper } from "./addPet.ts";
export { updatePetWrapper } from "./updatePet.ts";
export { getPetByIdWrapper } from "./getPetById.ts";
export { updatePetWithFormWrapper } from "./updatePetWithForm.ts";
export { deletePetWrapper } from "./deletePet.ts";
export { findPetsByStatusWrapper } from "./findPetsByStatus.ts";
export { findPetsByTagsWrapper } from "./findPetsByTags.ts";
export { placeOrderWrapper } from "./placeOrder.ts";
export { getOrderByIdWrapper } from "./getOrderById.ts";
export { deleteOrderWrapper } from "./deleteOrder.ts";
export { createUserWrapper } from "./createUser.ts";
export { createUsersWithListInputWrapper } from "./createUsersWithListInput.ts";
export { loginUserWrapper } from "./loginUser.ts";
export { logoutUserWrapper } from "./logoutUser.ts";
export { getUserByNameWrapper } from "./getUserByName.ts";
export { updateUserWrapper } from "./updateUser.ts";
export { deleteUserWrapper } from "./deleteUser.ts";

/* Re-export all handlers */
  export type { addPetHandler } from "./addPet.ts";
export type { updatePetHandler } from "./updatePet.ts";
export type { getPetByIdHandler } from "./getPetById.ts";
export type { updatePetWithFormHandler } from "./updatePetWithForm.ts";
export type { deletePetHandler } from "./deletePet.ts";
export type { findPetsByStatusHandler } from "./findPetsByStatus.ts";
export type { findPetsByTagsHandler } from "./findPetsByTags.ts";
export type { placeOrderHandler } from "./placeOrder.ts";
export type { getOrderByIdHandler } from "./getOrderById.ts";
export type { deleteOrderHandler } from "./deleteOrder.ts";
export type { createUserHandler } from "./createUser.ts";
export type { createUsersWithListInputHandler } from "./createUsersWithListInput.ts";
export type { loginUserHandler } from "./loginUser.ts";
export type { logoutUserHandler } from "./logoutUser.ts";
export type { getUserByNameHandler } from "./getUserByName.ts";
export type { updateUserHandler } from "./updateUser.ts";
export type { deleteUserHandler } from "./deleteUser.ts";

/* Routes object with all route functions */
export const routes = {
addPet: addPetRoute,
updatePet: updatePetRoute,
getPetById: getPetByIdRoute,
updatePetWithForm: updatePetWithFormRoute,
deletePet: deletePetRoute,
findPetsByStatus: findPetsByStatusRoute,
findPetsByTags: findPetsByTagsRoute,
placeOrder: placeOrderRoute,
getOrderById: getOrderByIdRoute,
deleteOrder: deleteOrderRoute,
createUser: createUserRoute,
createUsersWithListInput: createUsersWithListInputRoute,
loginUser: loginUserRoute,
logoutUser: logoutUserRoute,
getUserByName: getUserByNameRoute,
updateUser: updateUserRoute,
deleteUser: deleteUserRoute,
} as const;
