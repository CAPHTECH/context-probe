import type { InvoiceContract, PaymentSummary } from "../contracts/invoice-contract";

export function confirmInvoice(contract: InvoiceContract): PaymentSummary {
  return {
    invoiceId: contract.invoiceId,
    paidCents: contract.totalCents,
  };
}
