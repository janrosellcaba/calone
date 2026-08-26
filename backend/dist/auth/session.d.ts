import type { CookieOptions, Response } from "express";
export declare const SESSION_COOKIE = "calone_session";
export declare const SESSION_TTL_MS: number;
export declare function hashToken(token: string): string;
export declare function createSessionToken(): string;
export declare function passwordsMatch(provided: string, expected: string): boolean;
export declare function sessionCookieOptions(): CookieOptions;
export declare function clearSessionCookie(res: Response): void;
//# sourceMappingURL=session.d.ts.map