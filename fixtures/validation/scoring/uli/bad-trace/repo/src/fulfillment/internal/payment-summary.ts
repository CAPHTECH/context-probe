import type { InvoiceContract } from "../../billing/contracts/invoice-contract";

export interface PaymentSummary {
  contract: InvoiceContract;
}

export function createPaymentSummary(contract: InvoiceContract): PaymentSummary {
  return { contract };
}
