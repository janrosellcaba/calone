import type { CalendarAccount } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";

const REFRESH_SKEW_MS = 60_000;

const MICROSOFT_SCOPES = [
  "offline_access",
  "Calendars.Read",
  "User.Read",
].join(" ");

type TokenRefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

async function refreshGoogleToken(refreshToken: string): Promise<TokenRefreshResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Google token refresh failed:", detail);
    throw new AppError(401, "Google token refresh failed; reconnect the account");
  }

  return (await res.json()) as TokenRefreshResponse;
}

async function refreshMicrosoftToken(
  refreshToken: string,
): Promise<TokenRefreshResponse> {
  const tokenUrl = `https://login.microsoftonline.com/${config.microsoft.tenantId}/oauth2/v2.0/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.microsoft.clientId,
      client_secret: config.microsoft.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: MICROSOFT_SCOPES,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Microsoft token refresh failed:", detail);
    throw new AppError(
      401,
      "Microsoft token refresh failed; reconnect the account",
    );
  }

  return (await res.json()) as TokenRefreshResponse;
}

/**
 * Returns a usable access token, refreshing and persisting when near expiry.
 */
export async function ensureValidAccessToken(
  account: CalendarAccount,
): Promise<string> {
  if (
    account.expiresAt &&
    account.expiresAt.getTime() > Date.now() + REFRESH_SKEW_MS
  ) {
    return account.accessToken;
  }

  if (!account.refreshToken) {
    throw new AppError(
      401,
      `Account ${account.id} has no refresh token; reconnect required`,
    );
  }

  const refreshed =
    account.provider === "GOOGLE"
      ? await refreshGoogleToken(account.refreshToken)
      : await refreshMicrosoftToken(account.refreshToken);

  if (!refreshed.access_token) {
    throw new AppError(502, `${account.provider} refresh did not return access_token`);
  }

  const expiresAt =
    typeof refreshed.expires_in === "number"
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null;

  const updated = await prisma.calendarAccount.update({
    where: { id: account.id },
    data: {
      accessToken: refreshed.access_token,
      ...(refreshed.refresh_token
        ? { refreshToken: refreshed.refresh_token }
        : {}),
      expiresAt,
    },
  });

  return updated.accessToken;
}
