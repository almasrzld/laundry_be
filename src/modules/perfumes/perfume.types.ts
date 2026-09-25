export interface PerfumeEntity {
  id: number | string;
  id_perfumes?: number | string;
  name: string;
  name_perfumes?: string;
  code: string;
  scent_type?: string | null;
  description?: string | null;
  is_active: boolean | number;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface CreatePerfumeDto {
  name: string;
  name_perfumes?: string;
  code: string;
  scent_type?: string | null;
  description?: string | null;
  is_active?: boolean | number;
}

export interface UpdatePerfumeDto {
  name?: string;
  name_perfumes?: string;
  code?: string;
  scent_type?: string | null;
  description?: string | null;
  is_active?: boolean | number;
}
