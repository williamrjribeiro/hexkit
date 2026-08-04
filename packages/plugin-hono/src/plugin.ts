import type { GeneratedFile, HexkitPlugin } from "@hexkit/plugin-api";

const controllersSource = `import type { AddPet } from "../../core/application/add-pet.ts";
import type { DeleteOrder } from "../../core/application/delete-order.ts";
import type { DeletePet } from "../../core/application/delete-pet.ts";
import type { GetOrderById } from "../../core/application/get-order-by-id.ts";
import type { GetPetById } from "../../core/application/get-pet-by-id.ts";
import type { PlaceOrder } from "../../core/application/place-order.ts";
import type { UpdatePet } from "../../core/application/update-pet.ts";
import { addPetWrapper } from "../../generated/contracts/server/addPet.ts";
import { deleteOrderWrapper } from "../../generated/contracts/server/deleteOrder.ts";
import { deletePetWrapper } from "../../generated/contracts/server/deletePet.ts";
import { getOrderByIdWrapper } from "../../generated/contracts/server/getOrderById.ts";
import { getPetByIdWrapper } from "../../generated/contracts/server/getPetById.ts";
import { placeOrderWrapper } from "../../generated/contracts/server/placeOrder.ts";
import { updatePetWrapper } from "../../generated/contracts/server/updatePet.ts";
import { addPetResponseMap } from "../../generated/contracts/routes/addPet.ts";
import { getOrderByIdResponseMap } from "../../generated/contracts/routes/getOrderById.ts";
import { getPetByIdResponseMap } from "../../generated/contracts/routes/getPetById.ts";
import { placeOrderResponseMap } from "../../generated/contracts/routes/placeOrder.ts";
import { updatePetResponseMap } from "../../generated/contracts/routes/updatePet.ts";

export type HttpUseCases = {
  addPet: AddPet;
  updatePet: UpdatePet;
  getPetById: GetPetById;
  deletePet: DeletePet;
  placeOrder: PlaceOrder;
  getOrderById: GetOrderById;
  deleteOrder: DeleteOrder;
};

export class RequestValidationError extends Error {
  constructor(kind: string) {
    super(\`Invalid HTTP request: \${kind}\`);
    this.name = "RequestValidationError";
  }
}

export function createHttpControllers(useCases: HttpUseCases) {
  return {
    addPet: addPetWrapper(async (request) => {
      if (!request.isValid || !request.value.body) {
        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);
      }
      const pet = await useCases.addPet(request.value.body);
      return {
        status: "201",
        contentType: "application/json",
        data: addPetResponseMap["201"]["application/json"].parse(pet),
      };
    }),
    updatePet: updatePetWrapper(async (request) => {
      if (!request.isValid || !request.value.body) {
        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);
      }
      const pet = await useCases.updatePet(request.value.body);
      return {
        status: "200",
        contentType: "application/json",
        data: updatePetResponseMap["200"]["application/json"].parse(pet),
      };
    }),
    getPetById: getPetByIdWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      const pet = await useCases.getPetById(request.value.path.petId);
      if (!pet) return { status: "404" };
      return {
        status: "200",
        contentType: "application/json",
        data: getPetByIdResponseMap["200"]["application/json"].parse(pet),
      };
    }),
    deletePet: deletePetWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      await useCases.deletePet(request.value.path.petId);
      return { status: "204" };
    }),
    placeOrder: placeOrderWrapper(async (request) => {
      if (!request.isValid || !request.value.body) {
        throw new RequestValidationError(request.isValid ? "body-error" : request.kind);
      }
      const order = await useCases.placeOrder(request.value.body);
      return {
        status: "201",
        contentType: "application/json",
        data: placeOrderResponseMap["201"]["application/json"].parse(order),
      };
    }),
    getOrderById: getOrderByIdWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      const order = await useCases.getOrderById(request.value.path.orderId);
      if (!order) return { status: "404" };
      return {
        status: "200",
        contentType: "application/json",
        data: getOrderByIdResponseMap["200"]["application/json"].parse(order),
      };
    }),
    deleteOrder: deleteOrderWrapper(async (request) => {
      if (!request.isValid) throw new RequestValidationError(request.kind);
      await useCases.deleteOrder(request.value.path.orderId);
      return { status: "204" };
    }),
  };
}

export type HttpControllers = ReturnType<typeof createHttpControllers>;
`;

const routesSource = `import type { Context } from "hono";
import { Hono } from "hono";

import {
  createHttpControllers,
  type HttpControllers,
  type HttpUseCases,
  RequestValidationError,
} from "./controllers.ts";

type ApicalRequest = {
  query: unknown;
  path: unknown;
  headers: unknown;
  body?: unknown;
  contentType?: "application/json";
};

function request(context: Context): ApicalRequest {
  return {
    query: context.req.query(),
    path: context.req.param(),
    headers: context.req.raw.headers,
  };
}

async function jsonRequest(context: Context): Promise<ApicalRequest> {
  const contentType = context.req.header("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new RequestValidationError("body-error");
  }

  try {
    return {
      ...request(context),
      body: await context.req.json(),
      contentType: "application/json",
    };
  } catch {
    throw new RequestValidationError("body-error");
  }
}

function respond(result: {
  status: string;
  contentType?: "application/json";
  data?: unknown;
}): Response {
  const status = Number(result.status);
  if (result.data === undefined) return new Response(null, { status });
  return new Response(JSON.stringify(result.data), {
    status,
    headers: { "content-type": result.contentType ?? "application/json" },
  });
}

export function registerJsonRoutes(app: Hono, controllers: HttpControllers): void {
  app.post("/pet", async (context) =>
    respond(await controllers.addPet(await jsonRequest(context))),
  );
  app.put("/pet", async (context) =>
    respond(await controllers.updatePet(await jsonRequest(context))),
  );
  app.get("/pet/:petId", async (context) =>
    respond(await controllers.getPetById(request(context))),
  );
  app.delete("/pet/:petId", async (context) =>
    respond(await controllers.deletePet(request(context))),
  );
  app.post("/store/order", async (context) =>
    respond(await controllers.placeOrder(await jsonRequest(context))),
  );
  app.get("/store/order/:orderId", async (context) =>
    respond(await controllers.getOrderById(request(context))),
  );
  app.delete("/store/order/:orderId", async (context) =>
    respond(await controllers.deleteOrder(request(context))),
  );
}

export function createHonoApp(useCases: HttpUseCases): Hono {
  const app = new Hono();
  registerJsonRoutes(app, createHttpControllers(useCases));
  app.onError((error, context) => {
    if (error instanceof RequestValidationError) {
      return context.json({ error: "Bad Request" }, 400);
    }
    return context.json({ error: "Internal Server Error" }, 500);
  });
  return app;
}
`;

const runtimeSource = `import { createAddPet } from "../core/application/add-pet.ts";
import { createDeleteOrder } from "../core/application/delete-order.ts";
import { createDeletePet } from "../core/application/delete-pet.ts";
import { createGetOrderById } from "../core/application/get-order-by-id.ts";
import { createGetPetById } from "../core/application/get-pet-by-id.ts";
import { createPlaceOrder } from "../core/application/place-order.ts";
import { createUpdatePet } from "../core/application/update-pet.ts";
import type { OrderRepository } from "../core/ports/order-repository.ts";
import type { PetRepository } from "../core/ports/pet-repository.ts";
import { createHonoApp } from "../adapters/http/routes.ts";

export type RuntimeRepositories = {
  pets: PetRepository;
  orders: OrderRepository;
};

export function createApp(repositories: RuntimeRepositories) {
  return createHonoApp({
    addPet: createAddPet(repositories.pets),
    updatePet: createUpdatePet(repositories.pets),
    getPetById: createGetPetById(repositories.pets),
    deletePet: createDeletePet(repositories.pets),
    placeOrder: createPlaceOrder(repositories.orders),
    getOrderById: createGetOrderById(repositories.orders),
    deleteOrder: createDeleteOrder(repositories.orders),
  });
}
`;

export function generateHonoFiles(): GeneratedFile[] {
  return [
    {
      path: "src/adapters/http/controllers.ts",
      contents: controllersSource,
      ownership: "generated",
    },
    {
      path: "src/adapters/http/routes.ts",
      contents: routesSource,
      ownership: "generated",
    },
    {
      path: "src/runtime/app.ts",
      contents: runtimeSource,
      ownership: "generated",
    },
  ];
}

export function createHonoPlugin(): HexkitPlugin {
  return {
    name: "hono",
    generate(context) {
      for (const file of generateHonoFiles()) {
        context.writeFile(file);
      }
    },
  };
}
