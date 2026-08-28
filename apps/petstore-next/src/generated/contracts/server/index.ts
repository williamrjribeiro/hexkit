/* Route imports for routes object */
import { route as addPetRoute } from "./addPet.ts";
import { route as updatePetRoute } from "./updatePet.ts";
import { route as getPetByIdRoute } from "./getPetById.ts";
import { route as deletePetRoute } from "./deletePet.ts";
import { route as findPetsByStatusRoute } from "./findPetsByStatus.ts";
import { route as findPetsByTagsRoute } from "./findPetsByTags.ts";
import { route as placeOrderRoute } from "./placeOrder.ts";
import { route as getOrderByIdRoute } from "./getOrderById.ts";
import { route as deleteOrderRoute } from "./deleteOrder.ts";

/* Server operation wrappers */
export { addPetWrapper } from "./addPet.ts";
export { updatePetWrapper } from "./updatePet.ts";
export { getPetByIdWrapper } from "./getPetById.ts";
export { deletePetWrapper } from "./deletePet.ts";
export { findPetsByStatusWrapper } from "./findPetsByStatus.ts";
export { findPetsByTagsWrapper } from "./findPetsByTags.ts";
export { placeOrderWrapper } from "./placeOrder.ts";
export { getOrderByIdWrapper } from "./getOrderById.ts";
export { deleteOrderWrapper } from "./deleteOrder.ts";

/* Re-export all handlers */
  export type { addPetHandler } from "./addPet.ts";
export type { updatePetHandler } from "./updatePet.ts";
export type { getPetByIdHandler } from "./getPetById.ts";
export type { deletePetHandler } from "./deletePet.ts";
export type { findPetsByStatusHandler } from "./findPetsByStatus.ts";
export type { findPetsByTagsHandler } from "./findPetsByTags.ts";
export type { placeOrderHandler } from "./placeOrder.ts";
export type { getOrderByIdHandler } from "./getOrderById.ts";
export type { deleteOrderHandler } from "./deleteOrder.ts";

/* Routes object with all route functions */
export const routes = {
addPet: addPetRoute,
updatePet: updatePetRoute,
getPetById: getPetByIdRoute,
deletePet: deletePetRoute,
findPetsByStatus: findPetsByStatusRoute,
findPetsByTags: findPetsByTagsRoute,
placeOrder: placeOrderRoute,
getOrderById: getOrderByIdRoute,
deleteOrder: deleteOrderRoute,
} as const;
