export interface OngkirEntity {
  id: number | string;
  id_ongkirs?: number | string;
  outlets_id: number | string;
  units_id: number | string;
  name_ongkir: string;
  code_ongkir: string;
  free_radius: number;
  base_radius: number;
  base_price: number;
  step_radius: number;
  step_price: number;
  max_radius: number;
  // Attached outlet relations
  outlet_id?: string;
  outlet_name?: string;
  outlet_address?: string;
  outlet_latitude?: number;
  outlet_longitude?: number;
  outlet_phone?: string;
  // Attached unit relations
  unit_id?: string;
  unit_name?: string;
  unit_code?: string;
  unit_symbol?: string;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface CreateOngkirDto {
  outlets_id: number | string;
  units_id: number | string;
  name_ongkir: string;
  code_ongkir?: string;
  free_radius?: number;
  base_radius?: number;
  base_price?: number;
  step_radius?: number;
  step_price?: number;
  max_radius?: number;
}

export interface UpdateOngkirDto {
  outlets_id?: number | string;
  units_id?: number | string;
  name_ongkir?: string;
  code_ongkir?: string;
  free_radius?: number;
  base_radius?: number;
  base_price?: number;
  step_radius?: number;
  step_price?: number;
  max_radius?: number;
}

export interface CalculateOngkirDto {
  outlets_id?: number | string;
  latitude: number;
  longitude: number;
}

export interface OngkirTierPreview {
  tier_index: number;
  code: string;
  min_distance: number;
  max_distance: number;
  price: number;
  label: string;
  is_free: boolean;
  unit_symbol?: string;
}

export interface CalculateOngkirResult {
  distance: number;
  distance_km: number;
  price_ongkir: number;
  is_free: boolean;
  is_deliverable: boolean;
  message: string;
  tier_label: string;
  unit?: {
    id: string;
    name_unit: string;
    code_unit: string;
    symbol: string;
  } | null;
  outlet: {
    id: string;
    name_outlet: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  breakdown: {
    free_radius: number;
    base_radius: number;
    base_price: number;
    step_radius: number;
    step_price: number;
    max_radius: number;
    excess_distance?: number;
    additional_steps?: number;
  };
}
