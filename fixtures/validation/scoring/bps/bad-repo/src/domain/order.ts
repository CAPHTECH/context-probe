import { logInfo } from "../infrastructure/logger";

export interface Order {
  id: string;
}

export function snapshotOrder(order: Order): string {
  logInfo(order.id);
  return order.id;
}
