export interface RepoBot {
  readonly id: string;
  readonly place_id: string;
  readonly token: string;
  readonly is_enabled: boolean;
  readonly created_at: Date;
}
