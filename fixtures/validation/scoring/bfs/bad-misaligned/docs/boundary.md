# BFS bad

## Shared scenario

利用者が注文を確定すると、Billing context と Fulfillment context が同じ責務を共有する。
`InvoiceContract` と `ShipmentTicket` は常に同じ context で更新されなければならない。
請求と出荷指示は同じ ownership で扱う。
