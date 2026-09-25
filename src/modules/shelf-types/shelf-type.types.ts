export interface ShelfTypeEntity {
  id: number | string;
  id_shelf_types?: number | string;
  name: string;
  name_shelf_types?: string;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface CreateShelfTypeDto {
  name: string;
  name_shelf_types?: string;
}

export interface UpdateShelfTypeDto {
  name?: string;
  name_shelf_types?: string;
}
