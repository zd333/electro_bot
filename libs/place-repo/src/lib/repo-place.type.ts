export interface RepoPlace {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly host: string;
  readonly check_type: 'ping' | 'http';
  readonly unavailability_treshold_minutes: number | null;
  readonly created_at: Date;
  readonly is_disabled: boolean;
}
