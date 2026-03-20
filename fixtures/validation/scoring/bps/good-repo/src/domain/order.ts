export interface Order {
  id: string;
}

export function snapshotOrder(order: Order): string {
  return order.id;
}
