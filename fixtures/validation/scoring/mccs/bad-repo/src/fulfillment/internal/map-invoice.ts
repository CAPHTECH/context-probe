import { InvoiceEntity } from "../../billing/internal/invoice-entity";

export function mapInvoice(id: string, total: number): InvoiceEntity {
  return new InvoiceEntity(id, total);
}
