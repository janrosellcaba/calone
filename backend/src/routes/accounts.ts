import { Router } from "express";
import { prisma } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { syncSubCalendars, listAccountsForUser } from "../services/calendarSync.js";
import { ensureValidAccessToken } from "../services/tokenService.js";
import { getUserId } from "../types/express.js";

export const accountsRouter = Router();
export const subCalendarsRouter = Router();

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

accountsRouter.use(requireAuth);
subCalendarsRouter.use(requireAuth);

accountsRouter.get("/", async (req, res, next) => {
  try {
    const accounts = await listAccountsForUser(getUserId(req));
    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

accountsRouter.post("/sync-all", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const accounts = await prisma.calendarAccount.findMany({
      where: { userId },
    });

    const errors: Array<{ accountId: string; message: string }> = [];
    for (const account of accounts) {
      try {
        const accessToken = await ensureValidAccessToken(account);
        await syncSubCalendars(account, accessToken);
      } catch (err) {
        errors.push({
          accountId: account.id,
          message: err instanceof Error ? err.message : "Sync failed",
        });
      }
    }

    res.json({
      accounts: await listAccountsForUser(userId),
      errors,
    });
  } catch (err) {
    next(err);
  }
});

accountsRouter.post("/:id/sync-calendars", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(400, "Account id is required");
    }

    const account = await prisma.calendarAccount.findFirst({
      where: { id, userId: getUserId(req) },
    });

    if (!account) {
      throw new AppError(404, "Account not found");
    }

    const accessToken = await ensureValidAccessToken(account);
    const calendars = await syncSubCalendars(account, accessToken);
    res.json({ calendars });
  } catch (err) {
    next(err);
  }
});

accountsRouter.patch("/:id", async (req, res, next) => {
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

    if (typeof req.body?.displayName !== "string" || !req.body.displayName.trim()) {
      throw new AppError(400, "displayName must be a non-empty string");
    }

    const account = await prisma.calendarAccount.update({
      where: { id },
      data: { displayName: req.body.displayName.trim() },
      select: {
        id: true,
        displayName: true,
        email: true,
        provider: true,
      },
    });

    res.json({ account });
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

subCalendarsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(400, "Sub-calendar id is required");
    }

    const existing = await prisma.subCalendar.findFirst({
      where: {
        id,
        account: { userId: getUserId(req) },
      },
    });

    if (!existing) {
      throw new AppError(404, "Sub-calendar not found");
    }

    const data: {
      name?: string;
      color?: string;
      isActive?: boolean;
    } = {};

    if (req.body?.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim()) {
        throw new AppError(400, "Name must be a non-empty string");
      }
      data.name = req.body.name.trim();
    }

    if (req.body?.color !== undefined) {
      if (typeof req.body.color !== "string" || !HEX_COLOR_RE.test(req.body.color)) {
        throw new AppError(400, "Color must be a hex value like #4285F4");
      }
      const raw = req.body.color.trim();
      data.color =
        raw.length === 4
          ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase()
          : raw.toLowerCase();
    }

    if (req.body?.isActive !== undefined) {
      if (typeof req.body.isActive !== "boolean") {
        throw new AppError(400, "isActive must be a boolean");
      }
      data.isActive = req.body.isActive;
    }

    if (Object.keys(data).length === 0) {
      throw new AppError(400, "No fields to update");
    }

    const updated = await prisma.subCalendar.update({
      where: { id },
      data,
      select: {
        id: true,
        remoteId: true,
        name: true,
        color: true,
        isActive: true,
      },
    });

    res.json({ calendar: updated });
  } catch (err) {
    next(err);
  }
});
