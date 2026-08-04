import type { GeneratedFile, GenerationContext, HexkitPlugin } from "@hexkit/plugin-api";

export function generateDomainFiles(): GeneratedFile[] {
  return [
    {
      path: "src/core/domain/pet.ts",
      contents: `export type PetStatus = "available" | "pending" | "sold";

export type Pet = {
  id: number;
  name: string;
  status?: PetStatus;
};
`,
      ownership: "generated",
    },
    {
      path: "src/core/domain/order.ts",
      contents: `export type OrderStatus = "placed" | "approved" | "delivered";

export type Order = {
  id: number;
  petId: number;
  quantity: number;
  status: OrderStatus;
  complete: boolean;
};
`,
      ownership: "generated",
    },
  ];
}

export function generateRepositoryPortFiles(): GeneratedFile[] {
  return [
    {
      path: "src/core/ports/pet-repository.ts",
      contents: `import type { Pet } from "../domain/pet.ts";

export interface PetRepository {
  add(pet: Pet): Promise<Pet>;
  update(pet: Pet): Promise<Pet>;
  getById(petId: number): Promise<Pet | undefined>;
  delete(petId: number): Promise<void>;
}
`,
      ownership: "generated",
    },
    {
      path: "src/core/ports/order-repository.ts",
      contents: `import type { Order } from "../domain/order.ts";

export interface OrderRepository {
  place(order: Order): Promise<Order>;
  getById(orderId: number): Promise<Order | undefined>;
  delete(orderId: number): Promise<void>;
}
`,
      ownership: "generated",
    },
  ];
}

export function generateUseCaseFiles(): GeneratedFile[] {
  return [
    {
      path: "src/core/application/add-pet.ts",
      contents: `import type { Pet } from "../domain/pet.ts";
import type { PetRepository } from "../ports/pet-repository.ts";

export type AddPet = (pet: Pet) => Promise<Pet>;

export function createAddPet(pets: PetRepository): AddPet {
  return (pet) => pets.add(pet);
}
`,
      ownership: "protected",
    },
    {
      path: "src/core/application/update-pet.ts",
      contents: `import type { Pet } from "../domain/pet.ts";
import type { PetRepository } from "../ports/pet-repository.ts";

export type UpdatePet = (pet: Pet) => Promise<Pet>;

export function createUpdatePet(pets: PetRepository): UpdatePet {
  return (pet) => pets.update(pet);
}
`,
      ownership: "protected",
    },
    {
      path: "src/core/application/get-pet-by-id.ts",
      contents: `import type { Pet } from "../domain/pet.ts";
import type { PetRepository } from "../ports/pet-repository.ts";

export type GetPetById = (petId: number) => Promise<Pet | undefined>;

export function createGetPetById(pets: PetRepository): GetPetById {
  return (petId) => pets.getById(petId);
}
`,
      ownership: "protected",
    },
    {
      path: "src/core/application/delete-pet.ts",
      contents: `import type { PetRepository } from "../ports/pet-repository.ts";

export type DeletePet = (petId: number) => Promise<void>;

export function createDeletePet(pets: PetRepository): DeletePet {
  return (petId) => pets.delete(petId);
}
`,
      ownership: "protected",
    },
    {
      path: "src/core/application/place-order.ts",
      contents: `import type { Order } from "../domain/order.ts";
import type { OrderRepository } from "../ports/order-repository.ts";

export type PlaceOrder = (order: Order) => Promise<Order>;

export function createPlaceOrder(orders: OrderRepository): PlaceOrder {
  return (order) => orders.place(order);
}
`,
      ownership: "protected",
    },
    {
      path: "src/core/application/get-order-by-id.ts",
      contents: `import type { Order } from "../domain/order.ts";
import type { OrderRepository } from "../ports/order-repository.ts";

export type GetOrderById = (orderId: number) => Promise<Order | undefined>;

export function createGetOrderById(orders: OrderRepository): GetOrderById {
  return (orderId) => orders.getById(orderId);
}
`,
      ownership: "protected",
    },
    {
      path: "src/core/application/delete-order.ts",
      contents: `import type { OrderRepository } from "../ports/order-repository.ts";

export type DeleteOrder = (orderId: number) => Promise<void>;

export function createDeleteOrder(orders: OrderRepository): DeleteOrder {
  return (orderId) => orders.delete(orderId);
}
`,
      ownership: "protected",
    },
  ];
}

export function generateCoreFiles(): GeneratedFile[] {
  return [...generateDomainFiles(), ...generateRepositoryPortFiles(), ...generateUseCaseFiles()];
}

export function createHexagonalPlugin(): HexkitPlugin {
  return {
    name: "architecture-hexagonal",
    generate(context: GenerationContext) {
      for (const file of generateCoreFiles()) {
        context.writeFile(file);
      }
    },
  };
}
