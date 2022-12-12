export interface Place {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly host: string;
  readonly unavailabilityTresholdMinutes?: number;
}
