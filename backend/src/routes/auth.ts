import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  clearSessionCookie,
  createSessionToken,
  hashToken,
  secretsMatch,
  sessionCookieOptions,
} from "../auth/session.js";
import { config } from "../config.js";
import { getUserId } from "../types/express.js";

export const authRouter = Router();

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const BCRYPT_ROUNDS = 12;

function parseUsername(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function parsePassword(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function issueSession(userId: string, res: Response): Promise<void> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    },
  });

  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const username = parseUsername(req.body?.username);
    const password = parsePassword(req.body?.password);
    const inviteCode =
      typeof req.body?.inviteCode === "string" ? req.body.inviteCode : "";

    if (!USERNAME_RE.test(username)) {
      throw new AppError(
        400,
        "Username must be 3–32 characters (letters, numbers, ., _ or -)",
      );
    }

    if (password.length < 8) {
      throw new AppError(400, "Password must be at least 8 characters");
    }

    if (!inviteCode || !secretsMatch(inviteCode, config.registrationCode)) {
      throw new AppError(403, "Invalid invitation code");
    }

    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, "Username already taken");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { username, passwordHash },
    });

    await issueSession(user.id, res);
    res.status(201).json({ authenticated: true, username: user.username });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const username = parseUsername(req.body?.username);
    const password = parsePassword(req.body?.password);

    if (!username || !password) {
      throw new AppError(401, "Invalid username or password");
    }

    const user = await prisma.user.findUnique({ where: { username } });
    const passwordOk = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !passwordOk) {
      throw new AppError(401, "Invalid username or password");
    }

    await issueSession(user.id, res);
    res.json({ authenticated: true, username: user.username });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      await prisma.session
        .deleteMany({ where: { tokenHash: hashToken(token) } })
        .catch(() => undefined);
    }

    clearSessionCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.delete("/account", requireAuth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await prisma.user.delete({ where: { id: userId } });
    clearSessionCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", async (req, res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) {
      throw new AppError(401, "Unauthorized");
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { username: true } } },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      }
      clearSessionCookie(res);
      throw new AppError(401, "Unauthorized");
    }

    res.json({ authenticated: true, username: session.user.username });
  } catch (err) {
    next(err);
  }
});
