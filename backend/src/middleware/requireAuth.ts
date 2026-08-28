import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";
import { AppError } from "./errorHandler.js";
import { SESSION_COOKIE, hashToken } from "../auth/session.js";
import "../types/express.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) {
      throw new AppError(401, "Unauthorized");
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      }
      res.clearCookie(SESSION_COOKIE, { path: "/" });
      throw new AppError(401, "Unauthorized");
    }

    req.userId = session.userId;
    next();
  } catch (err) {
    next(err);
  }
}
