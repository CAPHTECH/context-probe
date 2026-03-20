import { snapshotOrder } from "../domain/order";
import { logInfo } from "../infrastructure/logger";

export function loadOrder(id: string): string {
  logInfo(id);
  return snapshotOrder({ id });
}
