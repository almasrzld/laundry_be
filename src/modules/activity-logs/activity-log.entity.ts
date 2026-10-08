export interface ActivityLogEntity {
  id_activity_logs?: number;
  id?: string;
  log_type: 'main' | 'secondary';
  users_id?: number | null;
  user_id?: string | null;
  user_code?: string | null;
  user_name?: string | null;
  user_role?: string | null;
  activity: string;
  ip_address?: string | null;
  location?: string | null;
  user_agent?: string | null;
  payload?: any;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;

  // Formatted date and time strings for convenience
  date_formatted?: string;
  time_formatted?: string;
}

export interface ActivityLogFilter {
  type?: 'main' | 'secondary' | string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}
