import type { CalendarAccount, SubCalendar } from "@prisma/client";
import { prisma } from "../db.js";
import type {
  AggregatorError,
  EventsResponse,
  UnifiedEvent,
} from "../types/events.js";
import { fetchGoogleEvents } from "./googleCalendar.js";
import { fetchMicrosoftEvents } from "./microsoftCalendar.js";
import { ensureValidAccessToken } from "./tokenService.js";

type ActiveSubCalendar = SubCalendar & { account: CalendarAccount };

async function fetchEventsForSubCalendar(
  sub: ActiveSubCalendar,
  from: Date,
  to: Date,
): Promise<UnifiedEvent[]> {
  const accessToken = await ensureValidAccessToken(sub.account);
  const params = {
    account: sub.account,
    accessToken,
    remoteId: sub.remoteId,
    subCalendarId: sub.id,
    color: sub.color,
    from,
    to,
  };

  if (sub.account.provider === "GOOGLE") {
    return fetchGoogleEvents(params);
  }

  return fetchMicrosoftEvents(params);
}

function toAggregatorError(
  sub: ActiveSubCalendar,
  err: unknown,
): AggregatorError {
  const message =
    err instanceof Error ? err.message : "Unknown calendar fetch error";
  return {
    accountId: sub.account.id,
    provider: sub.account.provider,
    email: sub.account.email,
    message: `${sub.name}: ${message}`,
  };
}

export async function aggregateEvents(
  from: Date,
  to: Date,
  userId: string,
): Promise<EventsResponse> {
  const subs = await prisma.subCalendar.findMany({
    where: {
      isActive: true,
      account: { userId },
    },
    include: { account: true },
    orderBy: { createdAt: "asc" },
  });

  const settled = await Promise.allSettled(
    subs.map((sub) => fetchEventsForSubCalendar(sub, from, to)),
  );

  const events: UnifiedEvent[] = [];
  const errors: AggregatorError[] = [];

  settled.forEach((result, index) => {
    const sub = subs[index]!;
    if (result.status === "fulfilled") {
      events.push(...result.value);
      return;
    }
    errors.push(toAggregatorError(sub, result.reason));
  });

  events.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return { events, errors };
}
