import { loadOrder } from "../application/load-order";

export function persistOrder(id: string): string {
  return loadOrder({ id });
}
