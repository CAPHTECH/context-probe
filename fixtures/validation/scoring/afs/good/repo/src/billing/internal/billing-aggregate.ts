import type { InvoiceContract } from "../contracts/invoice-contract";

export function settleInvoice(contract: InvoiceContract): string {
  return `${contract.id}:${contract.total}`;
}
