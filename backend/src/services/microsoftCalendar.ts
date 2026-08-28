import type { CalendarAccount } from "@prisma/client";
import type { UnifiedEvent } from "../types/events.js";

type GraphDateTime = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};

type GraphEvent = {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  isAllDay?: boolean;
  webLink?: string;
  location?: { displayName?: string };
  start?: GraphDateTime;
  end?: GraphDateTime;
};

type GraphCalendarViewResponse = {
  value?: GraphEvent[];
  "@odata.nextLink"?: string;
};

function graphDateToIso(
  value: GraphDateTime | undefined,
  allDay: boolean,
  fallback: string,
): string {
  if (!value) return fallback;

  if (allDay && value.date) {
    return `${value.date}T00:00:00.000Z`;
  }

  if (value.dateTime) {
    // With Prefer: outlook.timezone="UTC", dateTime is UTC without Z sometimes
    const raw = value.dateTime.endsWith("Z")
      ? value.dateTime
      : `${value.dateTime}Z`;
    return new Date(raw).toISOString();
  }

  if (value.date) {
    return `${value.date}T00:00:00.000Z`;
  }

  return fallback;
}

function mapMicrosoftEvent(
  event: GraphEvent,
  account: CalendarAccount,
): UnifiedEvent | null {
  if (!event.id) return null;

  const allDay = Boolean(event.isAllDay);
  const start = graphDateToIso(event.start, allDay, new Date().toISOString());
  const end = graphDateToIso(event.end, allDay, start);

  const mapped: UnifiedEvent = {
    id: `${account.id}_${event.id}`,
    title: event.subject?.trim() || "(Sin título)",
    start,
    end,
    allDay,
    source: "MICROSOFT",
    accountId: account.id,
    accountEmail: account.email ?? "",
    originalUrl: event.webLink ?? "https://outlook.office.com/calendar/",
  };

  if (event.location?.displayName) {
    mapped.location = event.location.displayName;
  }
  if (event.bodyPreview) {
    mapped.description = event.bodyPreview;
  }

  return mapped;
}

export async function fetchMicrosoftEvents(
  account: CalendarAccount,
  accessToken: string,
  from: Date,
  to: Date,
): Promise<UnifiedEvent[]> {
  const events: UnifiedEvent[] = [];
  let nextUrl: string | undefined = (() => {
    const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
    url.searchParams.set("startDateTime", from.toISOString());
    url.searchParams.set("endDateTime", to.toISOString());
    url.searchParams.set("$orderby", "start/dateTime");
    url.searchParams.set("$top", "100");
    return url.toString();
  })();

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Microsoft Graph API error (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as GraphCalendarViewResponse;
    for (const item of data.value ?? []) {
      const mapped = mapMicrosoftEvent(item, account);
      if (mapped) events.push(mapped);
    }
    nextUrl = data["@odata.nextLink"];
  }

  return events;
}
