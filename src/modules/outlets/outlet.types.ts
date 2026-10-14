export interface OutletEntity {
  id: number | string;
  id_outlets?: number | string;
  name_outlet: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  phone?: string | null;
  is_used?: boolean;
  used_count?: number;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface CreateOutletDto {
  name_outlet: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  phone?: string | null;
}

export interface UpdateOutletDto {
  name_outlet?: string;
  address?: string;
  latitude?: number | string;
  longitude?: number | string;
  phone?: string | null;
}
