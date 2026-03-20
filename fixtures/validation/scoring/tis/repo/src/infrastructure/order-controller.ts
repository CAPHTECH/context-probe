import { loadOrder } from "../application/load-order";

export function handleOrder(id: string): string {
  return loadOrder({ id });
}
