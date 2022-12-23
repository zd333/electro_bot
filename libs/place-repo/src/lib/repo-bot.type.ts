export interface RepoBot {
  readonly id: string;
  readonly bot_name: string | null;
  readonly place_id: string;
  readonly token: string;
  readonly is_enabled: boolean;
  readonly is_publically_listed: boolean;
  readonly created_at: Date;
}
