import { InternalOrder } from "../internal/order-entity";
import { logInfo } from "../infrastructure/logger";

export class OrderContract {
  constructor(
    public payload: any,
    public entity: InternalOrder
  ) {}
}

export function normalizeOrder(input: any): InternalOrder {
  logInfo(String(input?.id));
  return new InternalOrder(String(input?.id));
}
