import type { CalendarAccount, Provider } from "@prisma/client";
import { prisma } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";

export const APPLE_CALENDAR_COLORS = [
  "#007AFF",
  "#34C759",
  "#FF9F0A",
  "#AF52DE",
  "#FF375F",
  "#64D2FF",
  "#5E5CE6",
  "#30D158",
  "#FFD60A",
  "#FF453A",
  "#40C8E0",
  "#BF5AF2",
] as const;

export function appleColorAt(index: number): string {
  const color = APPLE_CALENDAR_COLORS[index % APPLE_CALENDAR_COLORS.length];
  return color ?? "#007AFF";
}

export const DEFAULT_GOOGLE_COLOR = appleColorAt(0);
export const DEFAULT_MICROSOFT_COLOR = appleColorAt(0);

export type RemoteCalendar = {
  remoteId: string;
  name: string;
  color: string;
};

export type SubCalendarSummary = {
  id: string;
  remoteId: string;
  name: string;
  color: string;
  isActive: boolean;
};

async function listGoogleCalendars(accessToken: string): Promise<RemoteCalendar[]> {
  const calendars: RemoteCalendar[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    );
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new AppError(
        502,
        `Failed to list Google calendars (${res.status}): ${detail}`,
      );
    }

    const data = (await res.json()) as {
      items?: Array<{
        id?: string;
        summary?: string;
        backgroundColor?: string;
      }>;
      nextPageToken?: string;
    };

    for (const [index, item] of (data.items ?? []).entries()) {
      if (!item.id) continue;
      calendars.push({
        remoteId: item.id,
        name: item.summary?.trim() || "Sin nombre",
        color: appleColorAt(index),
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return calendars;
}

async function listMicrosoftCalendars(
  accessToken: string,
): Promise<RemoteCalendar[]> {
  const calendars: RemoteCalendar[] = [];
  let nextUrl: string | undefined =
    "https://graph.microsoft.com/v1.0/me/calendars?$top=100";

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new AppError(
        502,
        `Failed to list Microsoft calendars (${res.status}): ${detail}`,
      );
    }

    const data = (await res.json()) as {
      value?: Array<{
        id?: string;
        name?: string;
        hexColor?: string;
      }>;
      "@odata.nextLink"?: string;
    };

    for (const item of data.value ?? []) {
      if (!item.id) continue;
      calendars.push({
        remoteId: item.id,
        name: item.name?.trim() || "Sin nombre",
        color: DEFAULT_MICROSOFT_COLOR,
      });
    }
    nextUrl = data["@odata.nextLink"];
  }

  return calendars;
}

export async function listRemoteCalendars(
  provider: Provider,
  accessToken: string,
): Promise<RemoteCalendar[]> {
  if (provider === "GOOGLE") {
    return listGoogleCalendars(accessToken);
  }
  return listMicrosoftCalendars(accessToken);
}

/**
 * Upserts remote calendars. Preserves local name, color and isActive on update
 * so user customizations are not overwritten.
 */
export async function syncSubCalendars(
  account: CalendarAccount,
  accessToken: string,
): Promise<SubCalendarSummary[]> {
  const remote = await listRemoteCalendars(account.provider, accessToken);
  const remoteIds = remote.map((item) => item.remoteId);

  await prisma.$transaction(async (tx) => {
    for (const [index, item] of remote.entries()) {
      await tx.subCalendar.upsert({
        where: {
          accountId_remoteId: {
            accountId: account.id,
            remoteId: item.remoteId,
          },
        },
        create: {
          accountId: account.id,
          remoteId: item.remoteId,
          name: item.name,
          color: appleColorAt(index),
          isActive: true,
        },
        update: {},
      });
    }

    if (remoteIds.length > 0) {
      await tx.subCalendar.deleteMany({
        where: {
          accountId: account.id,
          remoteId: { notIn: remoteIds },
        },
      });
    } else {
      await tx.subCalendar.deleteMany({ where: { accountId: account.id } });
    }
  });

  const rows = await prisma.subCalendar.findMany({
    where: { accountId: account.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      remoteId: true,
      name: true,
      color: true,
      isActive: true,
    },
  });

  const apple = new Set(
    APPLE_CALENDAR_COLORS.map((value) => value.toLowerCase()),
  );
  const needsPalette = rows.filter(
    (row) => !apple.has(row.color.toLowerCase()),
  );
  if (needsPalette.length > 0) {
    await Promise.all(
      needsPalette.map((row, index) =>
        prisma.subCalendar.update({
          where: { id: row.id },
          data: { color: appleColorAt(index) },
        }),
      ),
    );
    return prisma.subCalendar.findMany({
      where: { accountId: account.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        remoteId: true,
        name: true,
        color: true,
        isActive: true,
      },
    });
  }

  return rows;
}
