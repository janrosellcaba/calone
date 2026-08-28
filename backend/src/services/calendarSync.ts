import type { CalendarAccount, Provider } from "@prisma/client";
import { prisma } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";

export const MAX_SUBCALENDARS_PER_ACCOUNT = 10;

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

export type RemoteCalendar = {
  remoteId: string;
  name: string;
  primary: boolean;
  selected: boolean;
};

export type SubCalendarSummary = {
  id: string;
  remoteId: string;
  name: string;
  color: string;
  isActive: boolean;
};

function nextUnusedAppleColor(used: Iterable<string>): string {
  const taken = new Set(
    [...used].map((value) => value.trim().toLowerCase()),
  );
  for (const color of APPLE_CALENDAR_COLORS) {
    if (!taken.has(color.toLowerCase())) return color;
  }
  return appleColorAt(taken.size);
}

function selectCalendarsToKeep(
  remote: RemoteCalendar[],
  existingRemoteIds: string[],
): RemoteCalendar[] {
  const byId = new Map(remote.map((item) => [item.remoteId, item]));
  const keep: RemoteCalendar[] = [];
  const seen = new Set<string>();

  for (const id of existingRemoteIds) {
    const match = byId.get(id);
    if (match && keep.length < MAX_SUBCALENDARS_PER_ACCOUNT) {
      keep.push(match);
      seen.add(match.remoteId);
    }
  }

  const ranked = [...remote].sort((a, b) => {
    const rank = (item: RemoteCalendar) =>
      item.primary ? 0 : item.selected ? 1 : 2;
    return rank(a) - rank(b);
  });

  for (const item of ranked) {
    if (keep.length >= MAX_SUBCALENDARS_PER_ACCOUNT) break;
    if (seen.has(item.remoteId)) continue;
    keep.push(item);
    seen.add(item.remoteId);
  }

  return keep;
}

async function uniquifyUserColors(userId: string): Promise<void> {
  const rows = await prisma.subCalendar.findMany({
    where: { account: { userId } },
    orderBy: { createdAt: "asc" },
    select: { id: true, color: true },
  });

  const used = new Set<string>();
  for (const row of rows) {
    const current = row.color.trim().toLowerCase();
    if (current && !used.has(current)) {
      used.add(current);
      continue;
    }
    const next = nextUnusedAppleColor(used);
    await prisma.subCalendar.update({
      where: { id: row.id },
      data: { color: next },
    });
    used.add(next.toLowerCase());
  }
}

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
        primary?: boolean;
        selected?: boolean;
      }>;
      nextPageToken?: string;
    };

    for (const item of data.items ?? []) {
      if (!item.id) continue;
      calendars.push({
        remoteId: item.id,
        name: item.summary?.trim() || "Untitled",
        primary: Boolean(item.primary),
        selected: item.selected !== false,
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
        isDefaultCalendar?: boolean;
      }>;
      "@odata.nextLink"?: string;
    };

    for (const item of data.value ?? []) {
      if (!item.id) continue;
      calendars.push({
        remoteId: item.id,
        name: item.name?.trim() || "Untitled",
        primary: Boolean(item.isDefaultCalendar),
        selected: true,
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

const subCalendarSelect = {
  id: true,
  remoteId: true,
  name: true,
  color: true,
  isActive: true,
} as const;

/**
 * Upserts remote calendars (max 10 per account). Preserves local name,
 * color and isActive on update. Assigns unique Apple colors to new rows.
 */
export async function syncSubCalendars(
  account: CalendarAccount,
  accessToken: string,
): Promise<SubCalendarSummary[]> {
  const remote = await listRemoteCalendars(account.provider, accessToken);
  const existing = await prisma.subCalendar.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "asc" },
    select: { remoteId: true },
  });
  const keep = selectCalendarsToKeep(
    remote,
    existing.map((row) => row.remoteId),
  );
  const keepIds = keep.map((item) => item.remoteId);

  const usedColors = (
    await prisma.subCalendar.findMany({
      where: { account: { userId: account.userId } },
      select: { color: true },
    })
  ).map((row) => row.color);

  await prisma.$transaction(async (tx) => {
    const batchUsed = [...usedColors];
    for (const item of keep) {
      const existingRow = await tx.subCalendar.findUnique({
        where: {
          accountId_remoteId: {
            accountId: account.id,
            remoteId: item.remoteId,
          },
        },
        select: { color: true },
      });

      if (existingRow) {
        batchUsed.push(existingRow.color);
        continue;
      }

      const color = nextUnusedAppleColor(batchUsed);
      await tx.subCalendar.create({
        data: {
          accountId: account.id,
          remoteId: item.remoteId,
          name: item.name,
          color,
          isActive: true,
        },
      });
      batchUsed.push(color);
    }

    if (keepIds.length > 0) {
      await tx.subCalendar.deleteMany({
        where: {
          accountId: account.id,
          remoteId: { notIn: keepIds },
        },
      });
    } else {
      await tx.subCalendar.deleteMany({ where: { accountId: account.id } });
    }
  });

  await uniquifyUserColors(account.userId);

  return prisma.subCalendar.findMany({
    where: { accountId: account.id },
    orderBy: { name: "asc" },
    select: subCalendarSelect,
  });
}

export async function listAccountsForUser(userId: string) {
  const accounts = await prisma.calendarAccount.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      email: true,
      displayName: true,
      createdAt: true,
      expiresAt: true,
      subCalendars: {
        select: subCalendarSelect,
        orderBy: { name: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return accounts.map((account) => ({
    id: account.id,
    provider: account.provider,
    email: account.email,
    displayName: account.displayName,
    createdAt: account.createdAt.toISOString(),
    expiresAt: account.expiresAt?.toISOString() ?? null,
    subCalendars: account.subCalendars,
  }));
}
