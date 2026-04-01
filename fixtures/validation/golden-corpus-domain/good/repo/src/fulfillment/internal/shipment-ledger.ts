import type { ShipmentSummary, ShipmentTicket } from "../contracts/shipment-ticket";

export function confirmShipment(ticket: ShipmentTicket): ShipmentSummary {
  return {
    shipmentId: ticket.shipmentId,
    deliveredCount: ticket.confirmedCount,
  };
}
