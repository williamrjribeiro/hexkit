// Placeholder DAL for Task 5 only. Task 6 dogfood generation overwrites src/** with the
// generated Hexkit contracts, use cases, adapters, and real http-next/server-access module.
export type Pet = {
  id: number;
  name: string;
  status?: "available" | "pending" | "sold";
};

export type Order = {
  id: number;
  petId: number;
  quantity: number;
  status: "placed" | "approved" | "delivered";
  complete: boolean;
};

export type ServerAccess = {
  addPet(pet: Pet): Promise<Pet>;
  updatePet(pet: Pet): Promise<Pet>;
  getPetById(petId: number): Promise<Pet | undefined>;
  deletePet(petId: number): Promise<void>;
  placeOrder(order: Order): Promise<Order>;
  getOrderById(orderId: number): Promise<Order | undefined>;
  deleteOrder(orderId: number): Promise<void>;
};

const pets = new Map<number, Pet>([
  [1, { id: 1, name: "Ada", status: "available" }],
  [2, { id: 2, name: "Linus", status: "pending" }],
  [3, { id: 3, name: "Grace", status: "sold" }],
]);

const orders = new Map<number, Order>([
  [1, { id: 1, petId: 1, quantity: 1, status: "placed", complete: false }],
]);

export function getServerAccess(): ServerAccess {
  return {
    async addPet(pet) {
      pets.set(pet.id, pet);
      return pet;
    },
    async updatePet(pet) {
      pets.set(pet.id, pet);
      return pet;
    },
    async getPetById(petId) {
      return pets.get(petId);
    },
    async deletePet(petId) {
      pets.delete(petId);
    },
    async placeOrder(order) {
      orders.set(order.id, order);
      return order;
    },
    async getOrderById(orderId) {
      return orders.get(orderId);
    },
    async deleteOrder(orderId) {
      orders.delete(orderId);
    },
  };
}
