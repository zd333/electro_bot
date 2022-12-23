export interface Bot {
  readonly id: string;
  readonly botName?: string;
  readonly placeId: string;
  readonly token: string;
  readonly isEnabled: boolean;
  readonly isPublicallyListed: boolean;
}
