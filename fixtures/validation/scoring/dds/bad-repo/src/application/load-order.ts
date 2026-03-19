import { snapshotOrder } from "../domain/order";

export function loadOrder(id: string): string {
  return snapshotOrder({ id });
}
