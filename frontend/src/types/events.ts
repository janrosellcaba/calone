export type CalendarSource = "GOOGLE" | "MICROSOFT";

export interface UnifiedEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  source: CalendarSource;
  accountId: string;
  accountEmail?: string;
  originalUrl: string;
  location?: string;
  description?: string;
}

export interface CalendarAccountSummary {
  id: string;
  provider: CalendarSource;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  expiresAt: string | null;
}
