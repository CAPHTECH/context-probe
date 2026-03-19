import { logInfo } from "../infrastructure/logger";

export function placeOrder(orderId: string): string {
  logInfo(orderId);
  return orderId;
}
