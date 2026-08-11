export type OrderStatus = "placed" | "approved" | "delivered";

export type Order = {
  id: number;
  petId: number;
  quantity: number;
  status: OrderStatus;
  complete: boolean;
};
