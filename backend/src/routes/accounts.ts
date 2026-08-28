import { Router } from "express";
import { prisma } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getUserId } from "../types/express.js";

export const accountsRouter = Router();

accountsRouter.use(requireAuth);

accountsRouter.get("/", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const accounts = await prisma.calendarAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        email: true,
        displayName: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      accounts: accounts.map((account) => ({
        ...account,
        createdAt: account.createdAt.toISOString(),
        expiresAt: account.expiresAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

accountsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(400, "Account id is required");
    }

    const existing = await prisma.calendarAccount.findFirst({
      where: { id, userId: getUserId(req) },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, "Account not found");
    }

    await prisma.calendarAccount.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
