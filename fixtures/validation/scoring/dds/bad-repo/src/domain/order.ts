import { serializeOrder } from "../infrastructure/order-schema";

export interface Order {
  id: string;
}

export function snapshotOrder(order: Order): string {
  return serializeOrder(order.id);
}
