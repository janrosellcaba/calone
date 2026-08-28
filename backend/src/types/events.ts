import type { CalendarAccount } from "@prisma/client";

export type CalendarSource = "GOOGLE" | "MICROSOFT";

export interface UnifiedEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  source: CalendarSource;
  accountId: string;
  accountEmail: string;
  originalUrl: string;
  color: string;
  location?: string;
  description?: string;
}

export interface AggregatorError {
  accountId: string;
  provider: CalendarSource;
  email: string | null;
  message: string;
}

export interface EventsResponse {
  events: UnifiedEvent[];
  errors: AggregatorError[];
}

export type CalendarFetchParams = {
  account: CalendarAccount;
  accessToken: string;
  remoteId: string;
  subCalendarId: string;
  color: string;
  from: Date;
  to: Date;
};
