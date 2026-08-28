import type { CalendarFetchParams, UnifiedEvent } from "../types/events.js";

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
  params: CalendarFetchParams,
): UnifiedEvent | null {
  if (!event.id) return null;

  const allDay = Boolean(event.isAllDay);
  const start = graphDateToIso(event.start, allDay, new Date().toISOString());
  const end = graphDateToIso(event.end, allDay, start);

  const mapped: UnifiedEvent = {
    id: `${params.subCalendarId}_${event.id}`,
    title: event.subject?.trim() || "(Sin título)",
    start,
    end,
    allDay,
    source: "MICROSOFT",
    accountId: params.account.id,
    accountEmail: params.account.email ?? "",
    originalUrl: event.webLink ?? "https://outlook.office.com/calendar/",
    color: params.color,
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
  params: CalendarFetchParams,
): Promise<UnifiedEvent[]> {
  const events: UnifiedEvent[] = [];
  const calendarPath = encodeURIComponent(params.remoteId);
  let nextUrl: string | undefined = (() => {
    const url = new URL(
      `https://graph.microsoft.com/v1.0/me/calendars/${calendarPath}/calendarView`,
    );
    url.searchParams.set("startDateTime", params.from.toISOString());
    url.searchParams.set("endDateTime", params.to.toISOString());
    url.searchParams.set("$orderby", "start/dateTime");
    url.searchParams.set("$top", "100");
    return url.toString();
  })();

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Microsoft Graph API error (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as GraphCalendarViewResponse;
    for (const item of data.value ?? []) {
      const mapped = mapMicrosoftEvent(item, params);
      if (mapped) events.push(mapped);
    }
    nextUrl = data["@odata.nextLink"];
  }

  return events;
}
