/* Individual route exports */
export { clientRoute as addPetClientRoute, serverRoute as addPetServerRoute } from "./addPet.ts";
export {
  clientRoute as updatePetClientRoute,
  serverRoute as updatePetServerRoute,
} from "./updatePet.ts";
export {
  clientRoute as getPetByIdClientRoute,
  serverRoute as getPetByIdServerRoute,
} from "./getPetById.ts";
export {
  clientRoute as deletePetClientRoute,
  serverRoute as deletePetServerRoute,
} from "./deletePet.ts";
export {
  clientRoute as placeOrderClientRoute,
  serverRoute as placeOrderServerRoute,
} from "./placeOrder.ts";
export {
  clientRoute as getOrderByIdClientRoute,
  serverRoute as getOrderByIdServerRoute,
} from "./getOrderById.ts";
export {
  clientRoute as deleteOrderClientRoute,
  serverRoute as deleteOrderServerRoute,
} from "./deleteOrder.ts";

/* Route imports for routes object */
import { serverRoute as addPetRoute } from "./addPet.ts";
import { serverRoute as updatePetRoute } from "./updatePet.ts";
import { serverRoute as getPetByIdRoute } from "./getPetById.ts";
import { serverRoute as deletePetRoute } from "./deletePet.ts";
import { serverRoute as placeOrderRoute } from "./placeOrder.ts";
import { serverRoute as getOrderByIdRoute } from "./getOrderById.ts";
import { serverRoute as deleteOrderRoute } from "./deleteOrder.ts";

/* Combined routes object */
export const routes = {
  addPet: addPetRoute,
  updatePet: updatePetRoute,
  getPetById: getPetByIdRoute,
  deletePet: deletePetRoute,
  placeOrder: placeOrderRoute,
  getOrderById: getOrderByIdRoute,
  deleteOrder: deleteOrderRoute,
} as const;
