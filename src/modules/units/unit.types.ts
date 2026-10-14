export interface UnitEntity {
  id: number | string;
  id_units?: number | string;
  name_unit: string;
  code_unit: string;
  symbol?: string | null;
  description?: string | null;
  is_active: boolean | number;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface CreateUnitDto {
  name_unit: string;
  code_unit: string;
  symbol?: string | null;
  description?: string | null;
  is_active?: boolean | number;
}

export interface UpdateUnitDto {
  name_unit?: string;
  code_unit?: string;
  symbol?: string | null;
  description?: string | null;
  is_active?: boolean | number;
}
