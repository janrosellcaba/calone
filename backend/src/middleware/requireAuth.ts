import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";
import { AppError } from "./errorHandler.js";
import { SESSION_COOKIE, hashToken } from "../auth/session.js";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) {
      throw new AppError(401, "Unauthorized");
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      }
      throw new AppError(401, "Unauthorized");
    }

    next();
  } catch (err) {
    next(err);
  }
}
