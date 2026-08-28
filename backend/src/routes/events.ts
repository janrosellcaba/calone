import { Router } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { aggregateEvents } from "../services/eventAggregator.js";
import { getUserId } from "../types/express.js";

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

function parseIsoDate(value: unknown, name: string): Date {
  if (typeof value !== "string" || !value) {
    throw new AppError(400, `Query parameter "${name}" is required (ISO date)`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, `Query parameter "${name}" must be a valid ISO date`);
  }
  return date;
}

eventsRouter.get("/", async (req, res, next) => {
  try {
    const from = parseIsoDate(req.query.from, "from");
    const to = parseIsoDate(req.query.to, "to");

    if (from >= to) {
      throw new AppError(400, '"from" must be before "to"');
    }

    const result = await aggregateEvents(from, to, getUserId(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
});
