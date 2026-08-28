import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { CalendarAccount, Provider } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getUserId } from "../types/express.js";
import { syncSubCalendars } from "../services/calendarSync.js";

export const oauthRouter = Router();

const OAUTH_STATE_COOKIE = "calone_oauth_state";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const MICROSOFT_SCOPES = [
  "offline_access",
  "Calendars.Read",
  "User.Read",
].join(" ");

type OAuthTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type OAuthProfile = {
  externalId: string;
  email: string | null;
  displayName: string | null;
};

type OAuthStatePayload = {
  nonce: string;
  userId: string;
};

function signOAuthState(payload: OAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", config.sessionSecret)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function verifyOAuthState(value: string | undefined): OAuthStatePayload | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac("sha256", config.sessionSecret)
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<OAuthStatePayload>;
    if (
      typeof parsed.nonce !== "string" ||
      typeof parsed.userId !== "string"
    ) {
      return null;
    }
    return { nonce: parsed.nonce, userId: parsed.userId };
  } catch {
    return null;
  }
}

function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !config.isDev,
    path: "/",
    maxAge: 10 * 60 * 1000,
  };
}

function clearOAuthStateCookie(res: Response) {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: !config.isDev,
    path: "/",
  });
}

function redirectToIntegrations(query: Record<string, string>) {
  const url = new URL("/settings", config.appUrl);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function beginOAuthRedirect(res: Response, authUrl: URL, userId: string) {
  const nonce = randomBytes(24).toString("hex");
  res.cookie(
    OAUTH_STATE_COOKIE,
    signOAuthState({ nonce, userId }),
    oauthStateCookieOptions(),
  );
  authUrl.searchParams.set("state", nonce);
  res.redirect(authUrl.toString());
}

function readCallbackParams(req: Request) {
  const errorParam =
    typeof req.query.error === "string" ? req.query.error : null;
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const payload = verifyOAuthState(
    req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined,
  );

  return { errorParam, code, state, payload };
}

async function exchangeAuthorizationCode(
  tokenUrl: string,
  body: Record<string, string>,
  providerLabel: string,
): Promise<OAuthTokens> {
  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    console.error(`${providerLabel} token exchange failed:`, detail);
    throw new AppError(
      502,
      `Failed to exchange ${providerLabel} authorization code`,
    );
  }

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!tokens.access_token) {
    throw new AppError(502, `${providerLabel} did not return an access token`);
  }

  const result: OAuthTokens = {
    access_token: tokens.access_token,
  };
  if (tokens.refresh_token) result.refresh_token = tokens.refresh_token;
  if (typeof tokens.expires_in === "number") {
    result.expires_in = tokens.expires_in;
  }
  if (tokens.scope) result.scope = tokens.scope;
  return result;
}

async function upsertCalendarAccount(params: {
  userId: string;
  provider: Provider;
  profile: OAuthProfile;
  tokens: OAuthTokens;
  defaultScopes: string;
}): Promise<CalendarAccount> {
  const { userId, provider, profile, tokens, defaultScopes } = params;
  const expiresAt =
    typeof tokens.expires_in === "number"
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

  return prisma.calendarAccount.upsert({
    where: {
      userId_provider_externalId: {
        userId,
        provider,
        externalId: profile.externalId,
      },
    },
    create: {
      userId,
      provider,
      externalId: profile.externalId,
      email: profile.email,
      displayName: profile.displayName,
      scopes: tokens.scope ?? defaultScopes,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
    },
    update: {
      email: profile.email,
      scopes: tokens.scope ?? defaultScopes,
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt,
    },
  });
}

function handleOAuthCallbackError(
  res: Response,
  err: unknown,
  errorKey: string,
) {
  console.error(err);
  const message =
    err instanceof AppError ? err.message : "oauth_callback_failed";
  res.redirect(
    redirectToIntegrations({
      error: errorKey,
      detail: message,
    }),
  );
}

function microsoftAuthority(path: "authorize" | "token") {
  return `https://login.microsoftonline.com/${config.microsoft.tenantId}/oauth2/v2.0/${path}`;
}

// --- Google ---

oauthRouter.get("/google/start", requireAuth, (req, res) => {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.google.clientId);
  authUrl.searchParams.set("redirect_uri", config.google.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  beginOAuthRedirect(res, authUrl, getUserId(req));
});

oauthRouter.get("/google/callback", async (req, res) => {
  try {
    const { errorParam, code, state, payload } = readCallbackParams(req);
    clearOAuthStateCookie(res);

    if (errorParam) {
      res.redirect(
        redirectToIntegrations({ error: "google_denied", detail: errorParam }),
      );
      return;
    }

    if (!code || !state || !payload || state !== payload.nonce) {
      throw new AppError(400, "Invalid OAuth state or missing code");
    }

    const tokens = await exchangeAuthorizationCode(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.redirectUri,
        grant_type: "authorization_code",
      },
      "Google",
    );

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!profileRes.ok) {
      const detail = await profileRes.text();
      console.error("Google userinfo failed:", detail);
      throw new AppError(502, "Failed to fetch Google user profile");
    }

    const profile = (await profileRes.json()) as {
      sub?: string;
      email?: string;
      name?: string;
    };

    if (!profile.sub) {
      throw new AppError(502, "Google userinfo missing subject");
    }

    const account = await upsertCalendarAccount({
      userId: payload.userId,
      provider: "GOOGLE",
      profile: {
        externalId: profile.sub,
        email: profile.email ?? null,
        displayName: profile.name ?? null,
      },
      tokens,
      defaultScopes: GOOGLE_SCOPES,
    });

    try {
      await syncSubCalendars(account, tokens.access_token);
    } catch (syncErr) {
      console.error("Google calendar list sync failed:", syncErr);
    }

    res.redirect(redirectToIntegrations({ connected: "google" }));
  } catch (err) {
    handleOAuthCallbackError(res, err, "google_oauth");
  }
});

// --- Microsoft ---

oauthRouter.get("/microsoft/start", requireAuth, (req, res) => {
  const authUrl = new URL(microsoftAuthority("authorize"));
  authUrl.searchParams.set("client_id", config.microsoft.clientId);
  authUrl.searchParams.set("redirect_uri", config.microsoft.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", MICROSOFT_SCOPES);
  authUrl.searchParams.set("prompt", "consent");
  beginOAuthRedirect(res, authUrl, getUserId(req));
});

oauthRouter.get("/microsoft/callback", async (req, res) => {
  try {
    const { errorParam, code, state, payload } = readCallbackParams(req);
    clearOAuthStateCookie(res);

    if (errorParam) {
      const detail =
        typeof req.query.error_description === "string"
          ? req.query.error_description
          : errorParam;
      res.redirect(
        redirectToIntegrations({ error: "microsoft_denied", detail }),
      );
      return;
    }

    if (!code || !state || !payload || state !== payload.nonce) {
      throw new AppError(400, "Invalid OAuth state or missing code");
    }

    const tokens = await exchangeAuthorizationCode(
      microsoftAuthority("token"),
      {
        code,
        client_id: config.microsoft.clientId,
        client_secret: config.microsoft.clientSecret,
        redirect_uri: config.microsoft.redirectUri,
        grant_type: "authorization_code",
        scope: MICROSOFT_SCOPES,
      },
      "Microsoft",
    );

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      const detail = await profileRes.text();
      console.error("Microsoft Graph /me failed:", detail);
      throw new AppError(502, "Failed to fetch Microsoft user profile");
    }

    const profile = (await profileRes.json()) as {
      id?: string;
      displayName?: string;
      mail?: string | null;
      userPrincipalName?: string;
    };

    if (!profile.id) {
      throw new AppError(502, "Microsoft Graph /me missing id");
    }

    const account = await upsertCalendarAccount({
      userId: payload.userId,
      provider: "MICROSOFT",
      profile: {
        externalId: profile.id,
        email: profile.mail ?? profile.userPrincipalName ?? null,
        displayName: profile.displayName ?? null,
      },
      tokens,
      defaultScopes: MICROSOFT_SCOPES,
    });

    try {
      await syncSubCalendars(account, tokens.access_token);
    } catch (syncErr) {
      console.error("Microsoft calendar list sync failed:", syncErr);
    }

    res.redirect(redirectToIntegrations({ connected: "microsoft" }));
  } catch (err) {
    handleOAuthCallbackError(res, err, "microsoft_oauth");
  }
});
