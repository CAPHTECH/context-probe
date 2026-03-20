# AFS bad

## Shared consistency

`InvoiceContract` は Billing context の公開契約である。
`ShipmentTicket` は Fulfillment context の公開契約である。
注文確定後は Billing context の請求総額と Fulfillment context の出荷件数が常に一致していなければならない。
請求確定と出荷確定は同時に更新されなければならない。
