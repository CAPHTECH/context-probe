import type { Order } from "../domain/order";

export function loadOrder(order: Order): string {
  return order.id;
}
