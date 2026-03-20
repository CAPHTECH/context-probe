import type { ShipmentTicket } from "../contracts/shipment-ticket";

export function finalizeShipment(ticket: ShipmentTicket): string {
  return `${ticket.id}:${ticket.status}`;
}
