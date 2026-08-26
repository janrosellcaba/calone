import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(optional("PORT", "3001")),
  nodeEnv: optional("NODE_ENV", "development"),
  appUrl: optional("APP_URL", "http://localhost:5173"),
  apiUrl: optional("API_URL", "http://localhost:3001"),
  sessionSecret: required("SESSION_SECRET"),
  masterPassword: required("MASTER_PASSWORD"),
  databaseUrl: required("DATABASE_URL"),
  isDev: optional("NODE_ENV", "development") !== "production",
} as const;
