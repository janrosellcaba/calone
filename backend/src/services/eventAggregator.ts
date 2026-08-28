import type { CalendarAccount } from "@prisma/client";
import { prisma } from "../db.js";
import type {
  AggregatorError,
  EventsResponse,
  UnifiedEvent,
} from "../types/events.js";
import { fetchGoogleEvents } from "./googleCalendar.js";
import { fetchMicrosoftEvents } from "./microsoftCalendar.js";
import { ensureValidAccessToken } from "./tokenService.js";

async function fetchEventsForAccount(
  account: CalendarAccount,
  from: Date,
  to: Date,
): Promise<UnifiedEvent[]> {
  const accessToken = await ensureValidAccessToken(account);

  if (account.provider === "GOOGLE") {
    return fetchGoogleEvents(account, accessToken, from, to);
  }

  return fetchMicrosoftEvents(account, accessToken, from, to);
}

function toAggregatorError(
  account: CalendarAccount,
  err: unknown,
): AggregatorError {
  const message =
    err instanceof Error ? err.message : "Unknown calendar fetch error";
  return {
    accountId: account.id,
    provider: account.provider,
    email: account.email,
    message,
  };
}

export async function aggregateEvents(
  from: Date,
  to: Date,
  userId: string,
): Promise<EventsResponse> {
  const accounts = await prisma.calendarAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const settled = await Promise.allSettled(
    accounts.map((account) => fetchEventsForAccount(account, from, to)),
  );

  const events: UnifiedEvent[] = [];
  const errors: AggregatorError[] = [];

  settled.forEach((result, index) => {
    const account = accounts[index]!;
    if (result.status === "fulfilled") {
      events.push(...result.value);
      return;
    }
    errors.push(toAggregatorError(account, result.reason));
  });

  events.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return { events, errors };
}
