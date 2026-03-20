# BFS good

## Billing context

利用者が請求を確定すると、Billing context が請求合計を確定する。
`InvoiceContract` は Billing context の公開契約である。
請求は Billing context で確定しなければならない。

## Fulfillment context

利用者が出荷を確定すると、Fulfillment context が出荷指示を確定する。
`ShipmentTicket` は Fulfillment context の公開契約である。
出荷指示は Fulfillment context で確定しなければならない。

## 分離方針

Billing context と Fulfillment context は ownership が異なるため分離する。
