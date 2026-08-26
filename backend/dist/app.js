import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export function createApp() {
    const app = express();
    app.use(cors({
        origin: config.appUrl,
        credentials: true,
    }));
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/health", healthRouter);
    app.use("/api/auth", authRouter);
    // Production: serve Vite build from ../frontend/dist
    if (!config.isDev) {
        const frontendDist = path.resolve(__dirname, "../../frontend/dist");
        app.use(express.static(frontendDist));
        app.get("/{*splat}", (_req, res) => {
            res.sendFile(path.join(frontendDist, "index.html"));
        });
    }
    app.use(errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map