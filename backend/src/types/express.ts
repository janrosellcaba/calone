import type { Request } from "express";
import { AppError } from "../middleware/errorHandler.js";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

export function getUserId(req: Request): string {
  if (!req.userId) {
    throw new AppError(401, "Unauthorized");
  }
  return req.userId;
}
