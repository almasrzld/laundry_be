export interface OrderStatusEntity {
  id: number | string;
  id_order_statuses?: number | string;
  name: string;
  name_order_statuses?: string;
  code: string;
  step_order: number;
  color_hex?: string | null;
  badge_variant?: string | null;
  description?: string | null;
  is_active: boolean | number;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface CreateOrderStatusDto {
  name: string;
  name_order_statuses?: string;
  code: string;
  step_order?: number;
  color_hex?: string | null;
  badge_variant?: string | null;
  description?: string | null;
  is_active?: boolean | number;
}

export interface UpdateOrderStatusDto {
  name?: string;
  name_order_statuses?: string;
  code?: string;
  step_order?: number;
  color_hex?: string | null;
  badge_variant?: string | null;
  description?: string | null;
  is_active?: boolean | number;
}
