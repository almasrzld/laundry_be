export interface PaymentMethodEntity {
  id: number | string;
  id_payment_methods?: number | string;
  name: string;
  name_payment_methods?: string;
  code: string;
  type: string;
  account_number?: string | null;
  account_name?: string | null;
  description?: string | null;
  is_active: boolean | number;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface CreatePaymentMethodDto {
  name: string;
  name_payment_methods?: string;
  code: string;
  type?: string;
  account_number?: string | null;
  account_name?: string | null;
  description?: string | null;
  is_active?: boolean | number;
}

export interface UpdatePaymentMethodDto {
  name?: string;
  name_payment_methods?: string;
  code?: string;
  type?: string;
  account_number?: string | null;
  account_name?: string | null;
  description?: string | null;
  is_active?: boolean | number;
}
