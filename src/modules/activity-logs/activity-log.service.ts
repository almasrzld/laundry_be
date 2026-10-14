import { ActivityLogRepository } from './activity-log.repository';
import { ActivityLogEntity, ActivityLogFilter } from './activity-log.entity';

export class ActivityLogService {
  private repo: ActivityLogRepository;

  constructor(repo?: ActivityLogRepository) {
    this.repo = repo || new ActivityLogRepository();
  }

  async getActivityLogs(filter: ActivityLogFilter): Promise<{
    data: ActivityLogEntity[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    return await this.repo.findAll(filter);
  }

  async createActivityLog(data: {
    log_type: 'main' | 'secondary';
    users_id?: number | null;
    user_code?: string | null;
    user_name?: string | null;
    user_role?: string | null;
    activity: string;
    ip_address?: string | null;
    location?: string | null;
    user_agent?: string | null;
    payload?: any;
    creator?: number | null;
  }): Promise<number> {
    return await this.repo.create(data);
  }
}
