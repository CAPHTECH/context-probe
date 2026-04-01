export interface ShipmentTicket {
  shipmentId: string;
  requestedCount: number;
  confirmedCount: number;
}

export interface ShipmentSummary {
  shipmentId: string;
  deliveredCount: number;
}
