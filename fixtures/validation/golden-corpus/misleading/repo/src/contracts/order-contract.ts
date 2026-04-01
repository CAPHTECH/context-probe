export interface OrderContract {
  id: string;
  total: number;
}

export type OrderStatus = "pending" | "confirmed";
