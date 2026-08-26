import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
export const SESSION_COOKIE = "calone_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}
export function createSessionToken() {
    return randomBytes(32).toString("hex");
}
export function passwordsMatch(provided, expected) {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
        return false;
    }
    return timingSafeEqual(a, b);
}
export function sessionCookieOptions() {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: !config.isDev,
        path: "/",
        maxAge: SESSION_TTL_MS,
    };
}
export function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        sameSite: "lax",
        secure: !config.isDev,
        path: "/",
    });
}
//# sourceMappingURL=session.js.map