export interface InvoiceContract {
  invoiceId: string;
  totalCents: number;
  lineTotalCents: number;
}

export interface PaymentSummary {
  invoiceId: string;
  paidCents: number;
}
