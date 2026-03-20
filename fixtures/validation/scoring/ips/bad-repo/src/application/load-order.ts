import { OrderContract } from "../contracts/order-contract";

export function loadOrder(order: OrderContract): string {
  return String(order.payload?.id ?? "unknown");
}
