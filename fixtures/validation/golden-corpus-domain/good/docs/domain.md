# Domain evidence good

## Use Cases

Use case: a customer confirms an order and the Billing context confirms an invoice before Fulfillment publishes a shipment ticket.

Use case: an operator reviews the Payment Summary and Shipment Summary after the write flow is complete.

## Rules

The Billing context must publish `InvoiceContract` for downstream consumers.

The Fulfillment context must publish `ShipmentTicket` after shipment confirmation.

## Strong Invariants

Within the InvoiceLedger aggregate, invoice total and line total always are consistent.

Within the ShipmentLedger aggregate, requested shipment count and confirmed shipment count always are consistent.
