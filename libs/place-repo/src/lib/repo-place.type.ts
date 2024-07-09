export interface RepoPlace {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly host: string;
  readonly check_type: 'ping' | 'http';
  readonly unavailability_treshold_minutes: number | null;
  readonly created_at: Date;
  readonly disable_monthly_stats: boolean;
  readonly kyiv_schedule_group_id: number | null;
  readonly is_disabled: boolean;
}
