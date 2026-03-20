export function fulfillOrder(orderId: string): string {
  return `fulfill:${orderId}`;
}
