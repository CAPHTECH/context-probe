import type { ShipmentTicket } from "../contracts/shipment-ticket";

export function confirmShipment(ticket: ShipmentTicket): string {
  return `${ticket.id}:${ticket.status}`;
}
