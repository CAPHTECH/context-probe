import type { InvoiceContract } from "../../billing/contracts/invoice-contract";

export interface PaymentSummary {
  contract: InvoiceContract;
  label: string;
}

export function createPaymentSummary(contract: InvoiceContract): PaymentSummary {
  return {
    contract,
    label: `summary:${contract.id}`
  };
}
