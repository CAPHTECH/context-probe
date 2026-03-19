import type { InvoiceContract } from "../../billing/contracts/invoice-contract";
import { BillingInvoiceEntity } from "../../billing/internal/billing-invoice-entity";

export function mapInvoice(contract: InvoiceContract): BillingInvoiceEntity {
  return new BillingInvoiceEntity(contract.id, contract.total);
}
