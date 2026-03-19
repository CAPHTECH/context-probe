import type { InvoiceContract } from "../../billing/contracts/invoice-contract";

export function mapInvoice(contract: InvoiceContract): string {
  return `${contract.id}:${contract.total}`;
}
