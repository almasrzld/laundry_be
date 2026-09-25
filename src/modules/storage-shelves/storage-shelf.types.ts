export interface StorageShelfEntity {
  id: number | string;
  id_storage_shelves?: number | string;
  name: string;
  name_storage_shelves?: string;
  shelf_types_id?: number | string | null;
  code: string;
  capacity?: number | null;
  location_notes?: string | null;
  is_active: boolean | number;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface CreateStorageShelfDto {
  name: string;
  name_storage_shelves?: string;
  shelf_types_id?: number | string | null;
  code: string;
  capacity?: number | null;
  location_notes?: string | null;
  is_active?: boolean | number;
}

export interface UpdateStorageShelfDto {
  name?: string;
  name_storage_shelves?: string;
  shelf_types_id?: number | string | null;
  code?: string;
  capacity?: number | null;
  location_notes?: string | null;
  is_active?: boolean | number;
}
