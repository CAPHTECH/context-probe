# AFS good

## Billing context

`InvoiceContract` は Billing context の公開契約である。
Billing context では請求総額と明細合計が常に一致していなければならない。

## Fulfillment context

`ShipmentTicket` は Fulfillment context の公開契約である。
Fulfillment context では出荷指示の件数と確定件数が常に一致していなければならない。
