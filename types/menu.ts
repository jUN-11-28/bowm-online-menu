export interface Menu {
  id: number;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  description: string | null;
  is_sold_out: boolean;
  is_seasonal: boolean;
  is_signature: boolean;
  is_visible: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export const CATEGORIES = [
  "Coffee",
  "Beverage",
  "Tea",
  "Bakery",
  "Smoothie",
] as const;
export type Category = (typeof CATEGORIES)[number];
