export interface Place {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly host: string;
  readonly checkType: 'ping' | 'http';
  readonly unavailabilityTresholdMinutes?: number;
  readonly kyivScheduleGroupId?: number;
  readonly isDisabled: boolean;
}
