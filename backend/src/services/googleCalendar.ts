import type { CalendarAccount } from "@prisma/client";
import type { UnifiedEvent } from "../types/events.js";

type GoogleDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GoogleEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: GoogleDateTime;
  end?: GoogleDateTime;
};

type GoogleEventsResponse = {
  items?: GoogleEvent[];
  nextPageToken?: string;
};

function toIso(value: GoogleDateTime | undefined, fallback: string): {
  iso: string;
  allDay: boolean;
} {
  if (!value) {
    return { iso: fallback, allDay: false };
  }
  if (value.date) {
    // All-day: treat as UTC midnight of that calendar date
    return { iso: `${value.date}T00:00:00.000Z`, allDay: true };
  }
  if (value.dateTime) {
    return { iso: new Date(value.dateTime).toISOString(), allDay: false };
  }
  return { iso: fallback, allDay: false };
}

function mapGoogleEvent(
  event: GoogleEvent,
  account: CalendarAccount,
): UnifiedEvent | null {
  if (!event.id) return null;

  const start = toIso(event.start, new Date().toISOString());
  const end = toIso(event.end, start.iso);
  const allDay = Boolean(event.start?.date) || start.allDay;

  const mapped: UnifiedEvent = {
    id: `${account.id}_${event.id}`,
    title: event.summary?.trim() || "(Sin título)",
    start: start.iso,
    end: end.iso,
    allDay,
    source: "GOOGLE",
    accountId: account.id,
    accountEmail: account.email ?? "",
    originalUrl:
      event.htmlLink ??
      `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(event.id)}`,
  };

  if (event.location) mapped.location = event.location;
  if (event.description) mapped.description = event.description;

  return mapped;
}

export async function fetchGoogleEvents(
  account: CalendarAccount,
  accessToken: string,
  from: Date,
  to: Date,
): Promise<UnifiedEvent[]> {
  const events: UnifiedEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
    url.searchParams.set("timeMin", from.toISOString());
    url.searchParams.set("timeMax", to.toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Google Calendar API error (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as GoogleEventsResponse;
    for (const item of data.items ?? []) {
      const mapped = mapGoogleEvent(item, account);
      if (mapped) events.push(mapped);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}
