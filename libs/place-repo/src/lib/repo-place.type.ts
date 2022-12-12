export interface RepoPlace {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly host: string;
  readonly unavailability_treshold_minutes: number | null;
  readonly created_at: Date;
}
