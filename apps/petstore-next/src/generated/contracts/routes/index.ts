/* Individual route exports */
export { clientRoute as addPetClientRoute, serverRoute as addPetServerRoute } from "./addPet.ts";
export { clientRoute as updatePetClientRoute, serverRoute as updatePetServerRoute } from "./updatePet.ts";
export { clientRoute as getPetByIdClientRoute, serverRoute as getPetByIdServerRoute } from "./getPetById.ts";
export { clientRoute as updatePetWithFormClientRoute, serverRoute as updatePetWithFormServerRoute } from "./updatePetWithForm.ts";
export { clientRoute as deletePetClientRoute, serverRoute as deletePetServerRoute } from "./deletePet.ts";
export { clientRoute as findPetsByStatusClientRoute, serverRoute as findPetsByStatusServerRoute } from "./findPetsByStatus.ts";
export { clientRoute as findPetsByTagsClientRoute, serverRoute as findPetsByTagsServerRoute } from "./findPetsByTags.ts";
export { clientRoute as placeOrderClientRoute, serverRoute as placeOrderServerRoute } from "./placeOrder.ts";
export { clientRoute as getOrderByIdClientRoute, serverRoute as getOrderByIdServerRoute } from "./getOrderById.ts";
export { clientRoute as deleteOrderClientRoute, serverRoute as deleteOrderServerRoute } from "./deleteOrder.ts";
export { clientRoute as createUserClientRoute, serverRoute as createUserServerRoute } from "./createUser.ts";
export { clientRoute as createUsersWithListInputClientRoute, serverRoute as createUsersWithListInputServerRoute } from "./createUsersWithListInput.ts";
export { clientRoute as loginUserClientRoute, serverRoute as loginUserServerRoute } from "./loginUser.ts";
export { clientRoute as logoutUserClientRoute, serverRoute as logoutUserServerRoute } from "./logoutUser.ts";
export { clientRoute as getUserByNameClientRoute, serverRoute as getUserByNameServerRoute } from "./getUserByName.ts";
export { clientRoute as updateUserClientRoute, serverRoute as updateUserServerRoute } from "./updateUser.ts";
export { clientRoute as deleteUserClientRoute, serverRoute as deleteUserServerRoute } from "./deleteUser.ts";

/* Route imports for routes object */
import { serverRoute as addPetRoute } from "./addPet.ts";
import { serverRoute as updatePetRoute } from "./updatePet.ts";
import { serverRoute as getPetByIdRoute } from "./getPetById.ts";
import { serverRoute as updatePetWithFormRoute } from "./updatePetWithForm.ts";
import { serverRoute as deletePetRoute } from "./deletePet.ts";
import { serverRoute as findPetsByStatusRoute } from "./findPetsByStatus.ts";
import { serverRoute as findPetsByTagsRoute } from "./findPetsByTags.ts";
import { serverRoute as placeOrderRoute } from "./placeOrder.ts";
import { serverRoute as getOrderByIdRoute } from "./getOrderById.ts";
import { serverRoute as deleteOrderRoute } from "./deleteOrder.ts";
import { serverRoute as createUserRoute } from "./createUser.ts";
import { serverRoute as createUsersWithListInputRoute } from "./createUsersWithListInput.ts";
import { serverRoute as loginUserRoute } from "./loginUser.ts";
import { serverRoute as logoutUserRoute } from "./logoutUser.ts";
import { serverRoute as getUserByNameRoute } from "./getUserByName.ts";
import { serverRoute as updateUserRoute } from "./updateUser.ts";
import { serverRoute as deleteUserRoute } from "./deleteUser.ts";

/* Combined routes object */
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
