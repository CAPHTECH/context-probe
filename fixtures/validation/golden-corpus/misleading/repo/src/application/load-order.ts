import type { OrderContract } from "../contracts/order-contract";

export function loadOrder(order: OrderContract): string {
  return order.id;
}
