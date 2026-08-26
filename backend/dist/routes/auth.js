import { Router } from "express";
import { prisma } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";
import { SESSION_COOKIE, SESSION_TTL_MS, clearSessionCookie, createSessionToken, hashToken, passwordsMatch, sessionCookieOptions, } from "../auth/session.js";
import { config } from "../config.js";
export const authRouter = Router();
authRouter.post("/login", async (req, res, next) => {
    try {
        const password = typeof req.body?.password === "string" ? req.body.password : "";
        if (!password || !passwordsMatch(password, config.masterPassword)) {
            throw new AppError(401, "Invalid password");
        }
        const token = createSessionToken();
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
        await prisma.session.create({
            data: {
                tokenHash: hashToken(token),
                expiresAt,
            },
        });
        res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
        res.json({ authenticated: true });
    }
    catch (err) {
        next(err);
    }
});
authRouter.post("/logout", async (req, res, next) => {
    try {
        const token = req.cookies?.[SESSION_COOKIE];
        if (token) {
            await prisma.session
                .deleteMany({ where: { tokenHash: hashToken(token) } })
                .catch(() => undefined);
        }
        clearSessionCookie(res);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
authRouter.get("/me", async (req, res, next) => {
    try {
        const token = req.cookies?.[SESSION_COOKIE];
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
            clearSessionCookie(res);
            throw new AppError(401, "Unauthorized");
        }
        res.json({ authenticated: true });
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=auth.js.map