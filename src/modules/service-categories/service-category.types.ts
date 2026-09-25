export interface ServiceCategoryEntity {
  id: number | string;
  id_service_categories?: number | string;
  name: string;
  name_service_categories?: string;
  code: string;
  icon_code?: string | null;
  badge_color?: string | null;
  description?: string | null;
  is_active: boolean | number;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface CreateCategoryDto {
  name: string;
  name_service_categories?: string;
  code: string;
  icon_code?: string | null;
  badge_color?: string | null;
  description?: string | null;
  is_active?: boolean | number;
}

export interface UpdateCategoryDto {
  name?: string;
  name_service_categories?: string;
  code?: string;
  icon_code?: string | null;
  badge_color?: string | null;
  description?: string | null;
  is_active?: boolean | number;
}
