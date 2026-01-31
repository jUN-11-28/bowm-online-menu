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
// 방송 예약 관련 타입
export type BroadcastType = 'vibration' | 'vehicle' | 'smoking' | 'closing' | 'custom';
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type ClosingType = 'floor' | 'store';

export interface BroadcastSchedule {
  id: string;
  broadcast_type: BroadcastType;
  days_of_week: DayOfWeek[];
  hour: number;
  minute: number;
  vibration_number?: string;
  vehicle_number?: string;
  custom_text?: string;
  closing_type?: ClosingType;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}