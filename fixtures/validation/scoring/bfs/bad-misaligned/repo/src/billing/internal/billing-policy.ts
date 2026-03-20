import type { InvoiceContract } from "../contracts/invoice-contract";

export function finalizeInvoice(contract: InvoiceContract): string {
  return `${contract.id}:${contract.total}`;
}
